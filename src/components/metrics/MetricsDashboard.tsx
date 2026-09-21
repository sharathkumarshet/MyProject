import type {
  ConnectivityMetrics,
  FragmentationLayerMetrics,
  FragmentationMetrics,
  PcFluxLevel,
  StructuralBandMetrics,
  StructuralMetrics,
  TurfMetrics,
} from '../../types/metrics'
import { PC_FLUX_CLASSES, pcFluxClassDistribution } from '../../core/metrics/pcFluxClasses'

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  )
}

function BandCard({ title, band }: { title: string; band: StructuralBandMetrics }) {
  return (
    <div className="rounded border border-slate-700/60 bg-slate-950/30 p-2">
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <StatRow label="Volume (Σ count)" value={band.volume.toFixed(1)} />
        <StatRow label="Active cells" value={String(band.activeCells)} />
        <StatRow label="RH95 mean / max" value={`${band.rh95Mean.toFixed(1)} / ${band.rh95Max.toFixed(1)} m`} />
        <StatRow label="NL mean" value={band.nlMean.toFixed(2)} />
        <StatRow label="VPD mean" value={band.vpdMean.toFixed(3)} />
      </div>
    </div>
  )
}

function FragmentationCard({
  title,
  layer,
  patchDensityUnit,
  edgeDensityUnit,
}: {
  title: string
  layer: FragmentationLayerMetrics
  patchDensityUnit: string
  edgeDensityUnit: string
}) {
  return (
    <div className="rounded border border-slate-700/60 bg-slate-950/30 p-2">
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <StatRow label="Patches (NP)" value={String(layer.patchCount)} />
        <StatRow label={`Patch density (${patchDensityUnit})`} value={layer.patchDensity.toFixed(3)} />
        <StatRow label={`Edge density (${edgeDensityUnit})`} value={layer.edgeDensity.toFixed(3)} />
        <StatRow label="Largest patch (LPI %)" value={layer.largestPatchIndex.toFixed(2)} />
        <StatRow label="Mean patch area (m²)" value={layer.meanPatchAreaM2.toFixed(2)} />
        <StatRow label="FFI (0-1)" value={layer.fragmentationIndex.toFixed(3)} />
      </div>
    </div>
  )
}

export function MetricsDashboard({
  structural,
  turf,
  connectivity,
  fragmentation,
  highlightLevel,
  onToggleHighlight,
}: {
  structural: StructuralMetrics
  turf: TurfMetrics
  connectivity: ConnectivityMetrics
  fragmentation: FragmentationMetrics
  highlightLevel: PcFluxLevel | null
  onToggleHighlight: (level: PcFluxLevel) => void
}) {
  const distribution = pcFluxClassDistribution(connectivity.patches)

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-emerald-300">Structural</p>
        <div className="space-y-2">
          <BandCard title="Low vegetation (0.1-3.5 m)" band={structural.low} />
          <BandCard title="High vegetation (≥3.5 m)" band={structural.high} />
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-emerald-300">Fragmentation</p>
        <p className="mb-2 text-[9px] leading-snug text-slate-500">
          NP/PD/ED/LPI/AREA_MN per layer (own binary mask); overall uses a combined turf∪shrub∪tree mask, so overall NP
          can be less than the per-layer sum when adjacent patches merge. FFI is min-max normalized across these 4
          layers within this scene, not an absolute score.
        </p>
        <div className="space-y-2">
          <FragmentationCard title="Turf" layer={fragmentation.turf} patchDensityUnit={fragmentation.patchDensityUnit} edgeDensityUnit={fragmentation.edgeDensityUnit} />
          <FragmentationCard title="Shrubs" layer={fragmentation.shrub} patchDensityUnit={fragmentation.patchDensityUnit} edgeDensityUnit={fragmentation.edgeDensityUnit} />
          <FragmentationCard title="Trees" layer={fragmentation.tree} patchDensityUnit={fragmentation.patchDensityUnit} edgeDensityUnit={fragmentation.edgeDensityUnit} />
          <FragmentationCard title="Overall (turf ∪ shrub ∪ tree)" layer={fragmentation.overall} patchDensityUnit={fragmentation.patchDensityUnit} edgeDensityUnit={fragmentation.edgeDensityUnit} />
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-emerald-300">Turf</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <StatRow label="Coverage" value={`${turf.coverageM2.toLocaleString()} m²`} />
          <StatRow label="Volume" value={`${turf.turfVolumeM3.toFixed(1)} m³`} />
          <StatRow label="Patches" value={String(turf.patchCount)} />
          <StatRow label="Largest patch" value={`${turf.largestPatchM2.toLocaleString()} m²`} />
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-emerald-300">
          Connectivity — {connectivity.patches.length} (PC)
        </p>
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <StatRow label="Whole scene" value={`${(connectivity.wholeScenePc * 100).toFixed(2)}%`} />
          <StatRow label="Turf only" value={`${(connectivity.turfPc * 100).toFixed(2)}%`} />
          <StatRow label="Shrubs only" value={`${(connectivity.shrubPc * 100).toFixed(2)}%`} />
          <StatRow label="Trees only" value={`${(connectivity.treePc * 100).toFixed(2)}%`} />
        </div>

        <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">PCflux importance</p>
        <div className="space-y-1">
          {PC_FLUX_CLASSES.map((cls) => {
            const active = highlightLevel === cls.level
            const count = distribution[cls.level]
            return (
              <button
                key={cls.level}
                type="button"
                disabled={count === 0}
                onClick={() => onToggleHighlight(cls.level)}
                className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cls.color }} />
                  {cls.label}
                </span>
                <span className="text-slate-400">{count}</span>
              </button>
            )
          })}
        </div>

        <p className="mb-1.5 mt-3 text-[9px] uppercase tracking-[0.16em] text-slate-400">Top patches (dPC)</p>
        <div className="space-y-1">
          {[...connectivity.patches]
            .sort((a, b) => b.area - a.area)
            .slice(0, 5)
            .map((patch) => (
              <div key={patch.id} className="flex items-center justify-between rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-300">
                <span>
                  Patch #{patch.id} · {patch.area.toLocaleString()} m²
                </span>
                <span className="text-slate-400">{patch.dPC === null ? 'not tested' : `dPC ${patch.dPC.toFixed(1)}%`}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
