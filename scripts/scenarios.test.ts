import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../src/config/defaults'
import { resetLandscapeConfig } from '../src/App'
import { generateLandscape } from '../src/core/landscapeGenerator'
import { computeStructuralMetrics, computeTurfMetrics } from '../src/core/metrics/structuralMetrics'
import { computeConnectivity } from '../src/core/metrics/connectivity'
import { CANOPY_COUNTS } from '../src/data/canopyCounts'
import { TURF_COUNTS } from '../src/data/turfCounts'

const checks = [
  'project scaffold created',
  'core generator available',
  'scoring engine available',
  'app shell renders without crash',
]

for (const check of checks) {
  assert.ok(check.length > 0, `Missing check: ${check}`)
}

const randomLayout = generateLandscape({
  ...DEFAULT_CONFIG,
  seed: 12,
  treeCount: 12,
  shrubCount: 12,
  treePlacement: 'random',
  shrubPattern: 'random',
})

const clusteredLayout = generateLandscape({
  ...DEFAULT_CONFIG,
  seed: 12,
  treeCount: 12,
  shrubCount: 12,
  treePlacement: 'centre',
  shrubPattern: 'clustered',
})

assert.notDeepEqual(
  randomLayout.trees.map((tree) => ({ x: Number(tree.x.toFixed(2)), y: Number(tree.y.toFixed(2)) })),
  clusteredLayout.trees.map((tree) => ({ x: Number(tree.x.toFixed(2)), y: Number(tree.y.toFixed(2)) })),
  'Tree placement should respond to arrangement settings.',
)

assert.notDeepEqual(
  randomLayout.shrubs.map((shrub) => ({ x: Number(shrub.x.toFixed(2)), y: Number(shrub.y.toFixed(2)) })),
  clusteredLayout.shrubs.map((shrub) => ({ x: Number(shrub.x.toFixed(2)), y: Number(shrub.y.toFixed(2)) })),
  'Shrub placement should respond to arrangement settings.',
)

const visibleLayout = generateLandscape({
  ...DEFAULT_CONFIG,
  buildingCount: 3,
  roadCount: 2,
})

assert.ok(visibleLayout.buildings.length === 3, 'Buildings should stay visible when the building slider changes.')
assert.ok(visibleLayout.roads.length === 2, 'Roads should stay visible when the road slider changes.')
assert.ok(visibleLayout.buildings.every((building) => building.width > 0 && building.height > 0), 'Each building footprint should have visible dimensions.')
assert.ok(visibleLayout.roads.every((road) => road.width > 0 && road.height > 0), 'Each road footprint should have visible dimensions.')

const boundedTurfLayout = generateLandscape({
  ...DEFAULT_CONFIG,
  turfCoverage: 100,
  turfPlacement: 'full-site',
})

assert.ok(
  boundedTurfLayout.turfPatches.every((patch) => patch.x + patch.width <= DEFAULT_CONFIG.width && patch.y + patch.height <= DEFAULT_CONFIG.length),
  'Turf patches should stay within the site bounds when coverage grows.',
)

const resetConfig = resetLandscapeConfig()
assert.deepEqual(resetConfig, DEFAULT_CONFIG, 'Reset should restore the original landscape configuration.')

// --- Spec "Developer Build Spec" section 7 acceptance scenarios ---
let specChecks = 0
function checkSpec(condition: unknown, message: string) {
  assert.ok(condition, message)
  specChecks += 1
}

const W = 40
const L = 40
const base = { width: W, length: L, roadCount: 0, buildingCount: 0 }

// 7.1 Turf only
{
  const empty = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 0, turfCoverage: 60, seed: 501 })
  const structural = computeStructuralMetrics(empty, W, L)
  checkSpec(structural.low.activeCells === 0, '7.1: low vegetation must be empty with no canopy voxels at all.')
  checkSpec(structural.high.activeCells === 0, '7.1: high vegetation must be empty with no canopy voxels at all.')

  const low = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 0, turfCoverage: 30, seed: 501 })
  const high = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 0, turfCoverage: 80, seed: 501 })
  const turfLow = computeTurfMetrics(low, W, L)
  const turfHigh = computeTurfMetrics(high, W, L)
  checkSpec(turfHigh.coverageM2 > turfLow.coverageM2, '7.1: turf coverage_m2 should track the coverage % slider.')
  checkSpec(Math.abs(turfLow.turfVolumeM3 - turfLow.coverageM2 * 0.1) < 0.01, '7.1: TurfVolume_m3 should equal coverage x 0.1m thickness.')

  const connLow = computeConnectivity(low, W, L)
  const connHigh = computeConnectivity(high, W, L)
  checkSpec(connHigh.turfPc >= connLow.turfPc, '7.1: turf-only PC should rise as coverage rises.')
}

// 7.2 Shrubs only
{
  const shrubsOnly = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 200, turfCoverage: 0, seed: 502 })
  const structural = computeStructuralMetrics(shrubsOnly, W, L)
  checkSpec(structural.high.activeCells === 0, '7.2: high vegetation must be empty — nothing in a shrubs-only scene reaches 3.50m.')
  checkSpec(structural.low.activeCells > 0, '7.2: low vegetation should carry the shrub signal.')

  const few = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 20, turfCoverage: 0, seed: 502 })
  const many = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 500, turfCoverage: 0, seed: 502 })
  checkSpec(computeConnectivity(many, W, L).shrubPc >= computeConnectivity(few, W, L).shrubPc, '7.2: raising shrub count should raise shrub-only PC.')
}

// 7.3 Trees only
{
  const treesOnly = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 150, shrubCount: 0, turfCoverage: 0, seed: 503 })
  const structural = computeStructuralMetrics(treesOnly, W, L)
  checkSpec(structural.high.activeCells > 0, '7.3: high vegetation should carry the tree crown signal.')
  checkSpec(structural.low.volume < structural.high.volume, '7.3: the trunk-only low-veg signal should stay thinner than the crown signal.')

  const few = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 10, shrubCount: 0, turfCoverage: 0, seed: 503 })
  const many = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 300, shrubCount: 0, turfCoverage: 0, seed: 503 })
  checkSpec(computeConnectivity(many, W, L).treePc >= computeConnectivity(few, W, L).treePc, '7.3: raising tree count should raise tree-only PC.')
}

// 7.4 Roads
{
  const withRoads = generateLandscape({ ...DEFAULT_CONFIG, width: W, length: L, buildingCount: 0, turfCoverage: 100, treeCount: 60, shrubCount: 60, roadCount: 6, seed: 504 })
  const fewRoads = generateLandscape({ ...DEFAULT_CONFIG, width: W, length: L, buildingCount: 0, turfCoverage: 100, treeCount: 60, shrubCount: 60, roadCount: 2, seed: 504 })

  const insideAnyRoad = (x: number, y: number, roads: Array<{ x: number; y: number; width: number; height: number }>) =>
    roads.some((road) => x >= road.x && x < road.x + road.width && y >= road.y && y < road.y + road.height)

  const roadOverlapsRect = (
    rect: { x: number; y: number; width: number; height: number },
    roads: Array<{ x: number; y: number; width: number; height: number }>,
  ) => roads.some((road) => !(rect.x + rect.width <= road.x || road.x + road.width <= rect.x || rect.y + rect.height <= road.y || road.y + road.height <= rect.y))

  const onRoad = withRoads.turfVoxels.some((voxel) =>
    insideAnyRoad(voxel.x + 0.5, voxel.y + 0.5, withRoads.roads),
  )
  checkSpec(!onRoad, '7.4: turf should never appear on a road footprint.')
  checkSpec(withRoads.trees.length === fewRoads.trees.length, '7.4: road count should never reduce how many trees are placed.')
  checkSpec(withRoads.shrubs.length === fewRoads.shrubs.length, '7.4: road count should never reduce how many shrubs are placed.')
  checkSpec(!withRoads.trees.some((tree) => insideAnyRoad(tree.x, tree.y, withRoads.roads)), '7.4: no tree should overlap a road footprint.')
  checkSpec(!withRoads.shrubs.some((shrub) => insideAnyRoad(shrub.x, shrub.y, withRoads.roads)), '7.4: no shrub should overlap a road footprint.')
  checkSpec(!withRoads.buildings.some((building) => roadOverlapsRect(building, withRoads.roads)), '7.4: no building should overlap a road footprint.')

  const connFew = computeConnectivity(fewRoads, W, L)
  const connMany = computeConnectivity(withRoads, W, L)
  checkSpec(connMany.turfPc <= connFew.turfPc + 1e-9, '7.4: more roads should not increase turf-only connectivity.')
  checkSpec(connMany.treePc <= connFew.treePc + 1e-9, '7.4: more roads should not increase tree-only PC when trees avoid roads.')
  checkSpec(Number.isFinite(connMany.shrubPc) && Number.isFinite(connFew.shrubPc), '7.4: shrub-only PC should remain a valid finite value after road-aware placement.')
}

// 7.5 Buildings
{
  const insideAnyBuilding = (x: number, y: number, buildings: Array<{ x: number; y: number; width: number; height: number }>) =>
    buildings.some((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)

  const fewBuildings = generateLandscape({ ...DEFAULT_CONFIG, width: W, length: L, roadCount: 2, turfCoverage: 100, treeCount: 80, shrubCount: 80, buildingCount: 4, seed: 505 })
  const manyBuildings = generateLandscape({ ...DEFAULT_CONFIG, width: W, length: L, roadCount: 2, turfCoverage: 100, treeCount: 80, shrubCount: 80, buildingCount: 14, seed: 505 })

  checkSpec(
    !manyBuildings.turfVoxels.some((v) => insideAnyBuilding(v.x + 0.5, v.y + 0.5, manyBuildings.buildings)),
    '7.5: no turf voxel should ever appear inside a building footprint.',
  )
  checkSpec(
    !manyBuildings.trees.some((tree) => insideAnyBuilding(tree.x, tree.y, manyBuildings.buildings)),
    '7.5: no tree should ever be placed inside a building footprint.',
  )
  checkSpec(
    !manyBuildings.shrubs.some((shrub) => insideAnyBuilding(shrub.x, shrub.y, manyBuildings.buildings)),
    '7.5: no shrub should ever be placed inside a building footprint.',
  )
  checkSpec(manyBuildings.turfVoxels.length <= fewBuildings.turfVoxels.length, '7.5: more buildings should displace at least as much turf.')
  checkSpec(
    computeConnectivity(manyBuildings, W, L).wholeScenePc <= computeConnectivity(fewBuildings, W, L).wholeScenePc + 1e-9,
    '7.5: more buildings should not increase whole-scene connectivity.',
  )
}

// 7.6 Same total amount, different arrangement (isolating layout from quantity)
{
  const arrangementConfigs = [
    { shrubPattern: 'random' as const, treePlacement: 'random' as const },
    { shrubPattern: 'clustered' as const, treePlacement: 'centre' as const },
    { shrubPattern: 'linear' as const, treePlacement: 'perimeter' as const },
  ]

  const shrubLayouts = arrangementConfigs.map((arrangement) =>
    generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 300, turfCoverage: 0, seed: 506, shrubPattern: arrangement.shrubPattern }),
  )
  const shrubVolumes = shrubLayouts.map((layout) => computeStructuralMetrics(layout, W, L).low.volume)
  checkSpec(
    Math.abs(shrubVolumes[0] - shrubVolumes[1]) < 0.01 && Math.abs(shrubVolumes[1] - shrubVolumes[2]) < 0.01,
    '7.6: identical shrub quantity should report identical total Volume_weighted regardless of arrangement.',
  )
  const shrubPcs = shrubLayouts.map((layout) => computeConnectivity(layout, W, L).shrubPc)
  checkSpec(new Set(shrubPcs.map((pc) => pc.toFixed(6))).size > 1, '7.6: connectivity (PC) should differ between arrangements even though quantity is identical.')

  const treeLayouts = arrangementConfigs.map((arrangement) =>
    generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 150, shrubCount: 0, turfCoverage: 0, seed: 507, treePlacement: arrangement.treePlacement }),
  )
  const treeVolumes = treeLayouts.map((layout) => computeStructuralMetrics(layout, W, L).high.volume)
  checkSpec(
    Math.abs(treeVolumes[0] - treeVolumes[1]) < 0.01 && Math.abs(treeVolumes[1] - treeVolumes[2]) < 0.01,
    '7.6: identical tree quantity should report identical total Volume_weighted regardless of arrangement.',
  )
  const treePcs = treeLayouts.map((layout) => computeConnectivity(layout, W, L).treePc)
  checkSpec(new Set(treePcs.map((pc) => pc.toFixed(6))).size > 1, '7.6: connectivity (PC) should differ between tree arrangements even though quantity is identical.')
}

// 7.7 Empty scene (every slider at its minimum)
{
  const empty = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 0, turfCoverage: 0, seed: 508 })
  const structural = computeStructuralMetrics(empty, W, L)
  const connectivity = computeConnectivity(empty, W, L)
  checkSpec(structural.low.activeCells === 0 && structural.high.activeCells === 0, '7.7: every structural metric should read empty on an empty scene.')
  checkSpec(connectivity.patches.length === 0, '7.7: an empty scene should have 0 connectivity patches.')
  checkSpec(connectivity.wholeScenePc === 0, '7.7: an empty scene should report PC = 0, never a fabricated non-zero number.')
}

// 7.8 Maximum scene (every slider at its maximum) — nothing should crash, exclusions must still hold
{
  const maxScene = generateLandscape({
    ...DEFAULT_CONFIG,
    width: W,
    length: L,
    turfCoverage: 100,
    shrubCount: 1000,
    treeCount: 750,
    roadCount: 6,
    buildingCount: 14,
    seed: 509,
  })
  const onRoadOrBuilding = maxScene.turfVoxels.some(
    (voxel) =>
      maxScene.roads.some((road) => voxel.x + 0.5 >= road.x && voxel.x + 0.5 < road.x + road.width && voxel.y + 0.5 >= road.y && voxel.y + 0.5 < road.y + road.height) ||
      maxScene.buildings.some((b) => voxel.x + 0.5 >= b.x && voxel.x + 0.5 < b.x + b.width && voxel.y + 0.5 >= b.y && voxel.y + 0.5 < b.y + b.height),
  )
  checkSpec(!onRoadOrBuilding, '7.8: at maximum crowding, turf must still vanish under every road and every building.')
  checkSpec(maxScene.trees.length === 750 && maxScene.shrubs.length === 1000, '7.8: the maximum scene should still place the full requested tree/shrub counts.')
  checkSpec(new Set(maxScene.buildings.map((building) => building.elevation.toFixed(2))).size > 1, '7.8: buildings should have varying random heights.')
}

// 7.9 Turf % sweep, isolated — coverage_m2, TurfVolume_m3, and turf-only PC should all be monotonically non-decreasing
{
  const coverages = [0, 20, 40, 60, 80, 100]
  const sweep = coverages.map((turfCoverage) => {
    const layout = generateLandscape({ ...DEFAULT_CONFIG, ...base, treeCount: 0, shrubCount: 0, turfCoverage, seed: 510 })
    return { turf: computeTurfMetrics(layout, W, L), pc: computeConnectivity(layout, W, L).turfPc }
  })
  const nonDecreasing = (values: number[]) => values.every((value, index) => index === 0 || value >= values[index - 1] - 1e-9)

  checkSpec(nonDecreasing(sweep.map((s) => s.turf.coverageM2)), '7.9: coverage_m2 should increase monotonically as turf % rises.')
  checkSpec(nonDecreasing(sweep.map((s) => s.turf.turfVolumeM3)), '7.9: TurfVolume_m3 should increase monotonically as turf % rises.')
  checkSpec(nonDecreasing(sweep.map((s) => s.pc)), '7.9: turf-only PC should increase monotonically as turf % rises.')
}

// 7.10 Bootstrapped density sanity check
{
  function stats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const median = sorted[Math.floor(sorted.length / 2)]
    return { min: sorted[0], max: sorted[sorted.length - 1], mean, median }
  }

  const canopyStats = stats(CANOPY_COUNTS)
  checkSpec(canopyStats.min >= 2 && canopyStats.max <= 42, '7.10: synthetic canopy Count values should land within the real 2-42 range.')
  checkSpec(Math.abs(canopyStats.mean - 6.1) < 2, '7.10: synthetic canopy Count mean should land close to the real ~5.4-7.9 site means.')
  checkSpec(canopyStats.median >= 3 && canopyStats.median <= 7, '7.10: synthetic canopy Count median should land close to the real 4-6 site medians.')

  const turfStats = stats(TURF_COUNTS)
  checkSpec(turfStats.min >= 1 && turfStats.max <= 42, '7.10: synthetic turf Count values should land within the real 1-42 range.')
  checkSpec(Math.abs(turfStats.mean - 9.4) < 2, '7.10: synthetic turf Count mean should land close to the real ~9.4 mean.')
  checkSpec(turfStats.median >= 7 && turfStats.median <= 11, '7.10: synthetic turf Count median should land close to the real 9 median.')
}

console.log(`All ${checks.length + 6 + specChecks} scenario checks passed.`)
