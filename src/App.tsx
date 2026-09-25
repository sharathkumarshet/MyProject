import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { DEFAULT_CONFIG, LIMITS } from './config/defaults'
import { generateLandscape } from './core/landscapeGenerator'
import { scoreLandscape } from './core/scoring/scoringEngine'
import { computeStructuralMetrics, computeTurfMetrics } from './core/metrics/structuralMetrics'
import { computeConnectivity } from './core/metrics/connectivity'
import { computeFragmentation } from './core/metrics/fragmentationMetrics'
import { getPcFluxClass } from './core/metrics/pcFluxClasses'
import { HEIGHT_BANDS } from './core/voxel/bands'
import { MetricsDashboard } from './components/metrics/MetricsDashboard'
import { ScoreDashboard } from './components/score/ScoreDashboard'
import { ScenarioHistoryPanel } from './components/history/ScenarioHistoryPanel'
import type { GeneratedLandscape } from './types/landscape'
import type { PcFluxLevel } from './types/metrics'

// Trees render as one consistent dark green from trunk to crown, unlike shrubs which follow the height-band legend.
const TREE_COLOR = '#1f5f38'
const SHRUB_COLOR = '#4bab67'

function parseSourceIndex(id: string): number {
  return Number(id.slice(id.lastIndexOf('-') + 1))
}

export function resetLandscapeConfig() {
  return { ...DEFAULT_CONFIG }
}

function SliderControl({
  label,
  value,
  min,
  max,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  const handleNumberInput = (raw: string) => {
    if (raw === '') return
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    onChange(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-slate-300">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(event) => handleNumberInput(event.target.value)}
            className="w-16 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-right text-[11px] text-emerald-300 outline-none focus:border-emerald-400"
          />
          {suffix && <span className="text-[10px] text-slate-400">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-500"
      />
    </div>
  )
}

function OptionTabs({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="mt-2 flex gap-1 rounded-md border border-slate-700 bg-slate-800/60 p-1">
      {options.map((option) => {
        const normalizedValue = value.toLowerCase().replace(/\s+/g, '')
        const normalizedOption = option.toLowerCase().replace(/\s+/g, '')
        const selected = normalizedValue === normalizedOption
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-sm px-2 py-1 text-[9px] uppercase tracking-[0.12em] transition ${
              selected ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function BuildingModel({ x, y, width, depth, height }: { x: number; y: number; width: number; depth: number; height: number }) {
  return (
    <group position={[x, height / 2, y]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#4a5157" metalness={0.15} roughness={0.65} />
      </mesh>
      <mesh position={[0, height * 0.18, 0]} castShadow>
        <boxGeometry args={[width * 0.8, height * 0.14, depth * 0.8]} />
        <meshStandardMaterial color="#33383d" />
      </mesh>
    </group>
  )
}

function RoadModel({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <group position={[x, 0.04, y]}>
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.09, height]} />
        <meshStandardMaterial color="#4f5257" roughness={0.9} />
      </mesh>
    </group>
  )
}

interface VoxelInstance {
  x: number
  y: number
  z: number
  color: string
}

// Renders a Minecraft-style block layer (turf or canopy voxels) as one InstancedMesh for performance.
function VoxelInstances({ instances, size }: { instances: VoxelInstance[]; size: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      color.set(instance.color)
      mesh.setColorAt(index, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [instances])

  if (instances.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]} frustumCulled={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function LandscapeScene({
  config,
  generated,
  resetKey,
  highlightLevel,
  treeHighlightLevels,
  shrubHighlightLevels,
  turfHighlightLevels,
}: {
  config: typeof DEFAULT_CONFIG
  generated: GeneratedLandscape
  resetKey: number
  highlightLevel: PcFluxLevel | null
  treeHighlightLevels: (PcFluxLevel | undefined)[]
  shrubHighlightLevels: (PcFluxLevel | undefined)[]
  turfHighlightLevels: (PcFluxLevel | undefined)[]
}) {
  // Scale the zoom-out ceiling (and fog) to the site so the full turf stays reachable at any site size.
  const siteDiagonal = Math.hypot(config.width, config.length)
  const maxDistance = Math.max(30, siteDiagonal * 1.9 + 10)
  const fogFar = maxDistance + 20
  const fogNear = fogFar * 0.55

  const canopyInstances = useMemo<VoxelInstance[]>(() => {
    return generated.canopyVoxels.map((voxel) => {
      let color = voxel.source === 'shrub' ? SHRUB_COLOR : TREE_COLOR
      if (highlightLevel !== null) {
        const index = parseSourceIndex(voxel.sourceId)
        const level = voxel.source === 'shrub' ? shrubHighlightLevels[index] : treeHighlightLevels[index]
        if (level === highlightLevel) color = getPcFluxClass(highlightLevel).color
      }
      return {
        x: voxel.x + 0.5 - config.width / 2,
        y: voxel.z + 0.25,
        z: voxel.y + 0.5 - config.length / 2,
        color,
      }
    })
  }, [generated.canopyVoxels, config.width, config.length, highlightLevel, treeHighlightLevels, shrubHighlightLevels])

  const turfInstances = useMemo<VoxelInstance[]>(() => {
    return generated.turfVoxels.map((voxel) => {
      const color =
        highlightLevel !== null && turfHighlightLevels[voxel.patchIndex] === highlightLevel
          ? getPcFluxClass(highlightLevel).color
          : HEIGHT_BANDS[0].color
      return {
        x: voxel.x + 0.5 - config.width / 2,
        y: 0.05,
        z: voxel.y + 0.5 - config.length / 2,
        color,
      }
    })
  }, [generated.turfVoxels, config.width, config.length, highlightLevel, turfHighlightLevels])

  return (
    <Canvas key={resetKey} camera={{ position: [18, 18, 20], fov: 30 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#dfe5dc']} />
      <fog attach="fog" args={['#dfe5dc', fogNear, fogFar]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[12, 16, 10]} intensity={1.9} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-10, 10, -5]} intensity={0.55} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}>
        <planeGeometry args={[config.width + 10, config.length + 10]} />
        <meshStandardMaterial color="#dfe5dc" />
      </mesh>

      <group rotation={[0, Math.PI / 4.2, 0]} position={[0, 0.15, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[config.width, config.length]} />
          <meshStandardMaterial color="#8c6c45" />
        </mesh>

        <VoxelInstances instances={turfInstances} size={[1, 0.1, 1]} />
        <VoxelInstances instances={canopyInstances} size={[1, 0.5, 1]} />

        {generated.roads.map((road) => (
          <RoadModel
            key={road.id}
            x={road.x + road.width / 2 - config.width / 2}
            y={road.y + road.height / 2 - config.length / 2}
            width={road.width}
            height={road.height}
          />
        ))}

        {generated.buildings.map((building) => (
          <BuildingModel
            key={building.id}
            x={building.x + building.width / 2 - config.width / 2}
            y={building.y + building.height / 2 - config.length / 2}
            width={building.width}
            depth={building.height}
            height={building.elevation}
          />
        ))}
      </group>

      <ContactShadows position={[0, -0.02, 0]} scale={38} blur={2.2} opacity={0.5} far={12} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.8}
        minDistance={11}
        maxDistance={maxDistance}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.8, 0]}
      />
    </Canvas>
  )
}

function App() {
  const [config, setConfig] = useState(() => resetLandscapeConfig())
  const [sceneResetKey, setSceneResetKey] = useState(0)
  const [highlightLevel, setHighlightLevel] = useState<PcFluxLevel | null>(null)
  const generated = useMemo(() => generateLandscape(config), [config])

  const structural = useMemo(() => computeStructuralMetrics(generated, config.width, config.length), [generated, config.width, config.length])
  const turf = useMemo(() => computeTurfMetrics(generated, config.width, config.length), [generated, config.width, config.length])
  const connectivity = useMemo(() => computeConnectivity(generated, config.width, config.length), [generated, config.width, config.length])
  const fragmentation = useMemo(() => computeFragmentation(generated, config.width, config.length), [generated, config.width, config.length])
  const score = useMemo(() => scoreLandscape(connectivity, fragmentation), [connectivity, fragmentation])

  const treeHighlightLevels = useMemo(() => {
    const levels: (PcFluxLevel | undefined)[] = new Array(generated.trees.length).fill(undefined)
    connectivity.patches.forEach((patch) => {
      patch.members.forEach((member) => {
        if (member.type === 'tree') levels[member.index] = patch.importanceLevel
      })
    })
    return levels
  }, [connectivity, generated.trees.length])

  const shrubHighlightLevels = useMemo(() => {
    const levels: (PcFluxLevel | undefined)[] = new Array(generated.shrubs.length).fill(undefined)
    connectivity.patches.forEach((patch) => {
      patch.members.forEach((member) => {
        if (member.type === 'shrub') levels[member.index] = patch.importanceLevel
      })
    })
    return levels
  }, [connectivity, generated.shrubs.length])

  const turfHighlightLevels = useMemo(() => {
    const levels: (PcFluxLevel | undefined)[] = new Array(generated.turfPatches.length).fill(undefined)
    connectivity.patches.forEach((patch) => {
      patch.members.forEach((member) => {
        if (member.type === 'turf') levels[member.index] = patch.importanceLevel
      })
    })
    return levels
  }, [connectivity, generated.turfPatches.length])

  const highlightCount = highlightLevel === null ? 0 : connectivity.patches.filter((patch) => patch.importanceLevel === highlightLevel).length

  const updateConfig = <K extends keyof typeof DEFAULT_CONFIG>(key: K, value: (typeof DEFAULT_CONFIG)[K]) => {
    setConfig((previous) => ({ ...previous, [key]: value }))
  }

  const handleReset = () => {
    setConfig(resetLandscapeConfig())
    setSceneResetKey((current) => current + 1)
    setHighlightLevel(null)
  }

  const toggleHighlight = (level: PcFluxLevel) => {
    setHighlightLevel((current) => (current === level ? null : level))
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0d1c2a]">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#dfe5dc]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#101d2b] px-4 py-2.5 text-[11px] text-slate-300">
          <span className="text-[12px] font-medium text-slate-200">Vegetation Scenario Explorer</span>
          <span className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] text-emerald-300">PC {(connectivity.wholeScenePc * 100).toFixed(1)}%</span>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex-1 border-r border-slate-700 bg-[#dfe5dc]">
            <div className="absolute left-3 top-3 z-10 flex gap-2">
              <button type="button" className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200 shadow-sm">Top-down</button>
              <button type="button" onClick={handleReset} className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200 shadow-sm">Reset camera</button>
            </div>

            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded border border-slate-600 bg-slate-900/70 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-slate-200">
              <LegendSwatch color="#a2d86a" label="Turf" />
              <LegendSwatch color="#c8e6a0" label="Very low" />
              <LegendSwatch color="#4bab67" label="Low / hedge" />
              <LegendSwatch color="#2a8b4e" label="Medium" />
              <LegendSwatch color="#1f5f38" label="High veg" />
            </div>

            {highlightLevel !== null && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded border border-slate-600 bg-slate-800/90 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200 shadow-sm">
                <span>
                  Highlighting · {getPcFluxClass(highlightLevel).label.split(' ')[0]} · {highlightCount} patch(es)
                </span>
                <button type="button" onClick={() => setHighlightLevel(null)} className="text-slate-400 hover:text-slate-100">
                  ✕
                </button>
              </div>
            )}

            <div className="h-full w-full">
              <LandscapeScene
                config={config}
                generated={generated}
                resetKey={sceneResetKey}
                highlightLevel={highlightLevel}
                treeHighlightLevels={treeHighlightLevels}
                shrubHighlightLevels={shrubHighlightLevels}
                turfHighlightLevels={turfHighlightLevels}
              />
            </div>
          </div>

          <aside className="w-[300px] shrink-0 overflow-y-auto bg-[#0d1c2a] p-3 text-slate-200">
            <div className="space-y-4">
              <ScenarioHistoryPanel
                config={config}
                turf={turf}
                structural={structural}
                connectivity={connectivity}
                fragmentation={fragmentation}
                score={score}
              />

              <ScoreDashboard score={score} />

              <MetricsDashboard
                structural={structural}
                turf={turf}
                connectivity={connectivity}
                fragmentation={fragmentation}
                highlightLevel={highlightLevel}
                onToggleHighlight={toggleHighlight}
              />

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  <span>Site</span>
                  <span className="text-emerald-300">{score.percentage}%</span>
                </div>
                <SliderControl label="Width" value={config.width} min={LIMITS.width.min} max={LIMITS.width.max} suffix=" m" onChange={(value) => updateConfig('width', value)} />
                <SliderControl label="Length" value={config.length} min={LIMITS.length.min} max={LIMITS.length.max} suffix=" m" onChange={(value) => updateConfig('length', value)} />
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Scenario</div>
                <OptionTabs
                  value={config.scenario === 'temperate' ? 'Temperate' : 'Tropical'}
                  options={['Tropical', 'Temperate']}
                  onChange={(value) => updateConfig('scenario', value === 'Temperate' ? 'temperate' : 'tropical')}
                />
                <p className="mt-2 text-[9px] leading-snug text-slate-500">
                  Swaps only the tree/shrub voxel models (mango/rain-tree/palm ↔ pine/oak/spruce). Turf, buildings, and roads are unaffected.
                </p>
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Turf</div>
                <SliderControl label="Ground coverage" value={config.turfCoverage} min={LIMITS.turfCoverage.min} max={LIMITS.turfCoverage.max} suffix=" %" onChange={(value) => updateConfig('turfCoverage', value)} />
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Shrubs</div>
                <SliderControl label="Count" value={config.shrubCount} min={LIMITS.shrubCount.min} max={LIMITS.shrubCount.max} onChange={(value) => updateConfig('shrubCount', value)} />
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Arrangement</div>
                  <OptionTabs
                    value={
                      config.shrubPattern === 'random'
                        ? 'Scattered'
                        : config.shrubPattern === 'clustered'
                          ? 'Clustered'
                          : 'Line'
                    }
                    options={['Scattered', 'Clustered', 'Line']}
                    onChange={(value) => updateConfig('shrubPattern', value === 'Clustered' ? 'clustered' : value === 'Line' ? 'linear' : 'random')}
                  />
                </div>
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Trees</div>
                <SliderControl label="Count" value={config.treeCount} min={LIMITS.treeCount.min} max={LIMITS.treeCount.max} onChange={(value) => updateConfig('treeCount', value)} />
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Arrangement</div>
                  <OptionTabs
                    value={
                      config.treePlacement === 'random'
                        ? 'Scattered'
                        : config.treePlacement === 'centre'
                          ? 'Clustered'
                          : 'Line'
                    }
                    options={['Scattered', 'Clustered', 'Line']}
                    onChange={(value) => updateConfig('treePlacement', value === 'Clustered' ? 'centre' : value === 'Line' ? 'perimeter' : 'random')}
                  />
                </div>
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Buildings</div>
                <SliderControl label="Count" value={config.buildingCount} min={LIMITS.buildingCount.min} max={LIMITS.buildingCount.max} onChange={(value) => updateConfig('buildingCount', value)} />
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Arrangement</div>
                  <OptionTabs
                    value={
                      config.buildingPattern === 'random'
                        ? 'Scattered'
                        : config.buildingPattern === 'clustered'
                          ? 'Clustered'
                          : 'Line'
                    }
                    options={['Scattered', 'Clustered', 'Line']}
                    onChange={(value) => updateConfig('buildingPattern', value === 'Clustered' ? 'clustered' : value === 'Line' ? 'linear' : 'random')}
                  />
                </div>
              </div>

              <div className="rounded border border-slate-700 bg-slate-900/20 p-3">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">Roads</div>
                <SliderControl label="Count" value={config.roadCount} min={LIMITS.roadCount.min} max={LIMITS.roadCount.max} onChange={(value) => updateConfig('roadCount', value)} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

export default App
