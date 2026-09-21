import { useEffect, useState } from 'react'
import {
  clearScenarioHistory,
  downloadScenarioHistoryCsv,
  loadScenarioHistory,
  saveScenarioRecord,
  type ScenarioRecord,
} from '../../core/scenarioStore'
import type { LandscapeConfig } from '../../types/landscape'
import type { ConnectivityMetrics, StructuralMetrics, TurfMetrics } from '../../types/metrics'
import type { ScoreBreakdown } from '../../types/scoring'

export function ScenarioHistoryPanel({
  config,
  turf,
  structural,
  connectivity,
  score,
}: {
  config: LandscapeConfig
  turf: TurfMetrics
  structural: StructuralMetrics
  connectivity: ConnectivityMetrics
  score: ScoreBreakdown
}) {
  const [records, setRecords] = useState<ScenarioRecord[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setRecords(loadScenarioHistory())
  }, [])

  const handleSave = () => {
    const updated = saveScenarioRecord(config, turf, structural, connectivity, score)
    setRecords(updated)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1200)
  }

  const handleExport = () => {
    if (records.length === 0) return
    downloadScenarioHistoryCsv(records)
  }

  const handleClear = () => {
    if (records.length === 0) return
    if (!window.confirm(`Delete all ${records.length} saved scenario(s)? This cannot be undone.`)) return
    setRecords(clearScenarioHistory())
  }

  return (
    <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-emerald-300">
        <span>Scenario history</span>
        <span className="text-slate-400">{records.length} saved</span>
      </div>
      <p className="mb-3 text-[10px] leading-snug text-slate-400">
        Save the current inputs and metrics as a row, then export everything to CSV to compare scenarios in Excel.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300 hover:bg-emerald-500/20"
        >
          {savedFlash ? 'Saved ✓' : 'Save scenario'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={records.length === 0}
          className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={records.length === 0}
          className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear history
        </button>
      </div>
    </div>
  )
}
