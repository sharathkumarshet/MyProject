import type { LandscapeConfig } from '../types/landscape'
import type { ConnectivityMetrics, StructuralMetrics, TurfMetrics } from '../types/metrics'
import type { ScoreBreakdown } from '../types/scoring'

const STORAGE_KEY = 'scenario-history-v1'

export interface ScenarioRecord {
  id: string
  savedAt: string
  config: LandscapeConfig
  turf: TurfMetrics
  structural: StructuralMetrics
  connectivity: {
    wholeScenePc: number
    turfPc: number
    shrubPc: number
    treePc: number
    patchCount: number
  }
  score: {
    total: number
    percentage: number
  }
}

function readAll(): ScenarioRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records: ScenarioRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function loadScenarioHistory(): ScenarioRecord[] {
  return readAll()
}

export function saveScenarioRecord(
  config: LandscapeConfig,
  turf: TurfMetrics,
  structural: StructuralMetrics,
  connectivity: ConnectivityMetrics,
  score: ScoreBreakdown,
): ScenarioRecord[] {
  const record: ScenarioRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    config: { ...config },
    turf: { ...turf },
    structural: { low: { ...structural.low }, high: { ...structural.high } },
    connectivity: {
      wholeScenePc: connectivity.wholeScenePc,
      turfPc: connectivity.turfPc,
      shrubPc: connectivity.shrubPc,
      treePc: connectivity.treePc,
      patchCount: connectivity.patches.length,
    },
    score: { total: score.total, percentage: score.percentage },
  }
  const records = [...readAll(), record]
  writeAll(records)
  return records
}

export function clearScenarioHistory(): ScenarioRecord[] {
  writeAll([])
  return []
}

const CSV_COLUMNS: { header: string; get: (r: ScenarioRecord) => string | number }[] = [
  { header: 'Saved at', get: (r) => r.savedAt },
  { header: 'Width (m)', get: (r) => r.config.width },
  { header: 'Length (m)', get: (r) => r.config.length },
  { header: 'Seed', get: (r) => r.config.seed },
  { header: 'Turf coverage (%)', get: (r) => r.config.turfCoverage },
  { header: 'Shrub count', get: (r) => r.config.shrubCount },
  { header: 'Shrub pattern', get: (r) => r.config.shrubPattern },
  { header: 'Shrub density', get: (r) => r.config.shrubDensity },
  { header: 'Tree count', get: (r) => r.config.treeCount },
  { header: 'Tree placement', get: (r) => r.config.treePlacement },
  { header: 'Tree distribution', get: (r) => r.config.treeDistribution },
  { header: 'Building count', get: (r) => r.config.buildingCount },
  { header: 'Building pattern', get: (r) => r.config.buildingPattern },
  { header: 'Road count', get: (r) => r.config.roadCount },
  { header: 'Turf coverage (m2)', get: (r) => r.turf.coverageM2 },
  { header: 'Turf volume (m3)', get: (r) => r.turf.turfVolumeM3.toFixed(2) },
  { header: 'Turf patch count', get: (r) => r.turf.patchCount },
  { header: 'Turf largest patch (m2)', get: (r) => r.turf.largestPatchM2 },
  { header: 'Low veg volume', get: (r) => r.structural.low.volume.toFixed(2) },
  { header: 'Low veg active cells', get: (r) => r.structural.low.activeCells },
  { header: 'Low veg RH95 mean (m)', get: (r) => r.structural.low.rh95Mean.toFixed(2) },
  { header: 'Low veg RH95 max (m)', get: (r) => r.structural.low.rh95Max.toFixed(2) },
  { header: 'Low veg NL mean', get: (r) => r.structural.low.nlMean.toFixed(3) },
  { header: 'Low veg VPD mean', get: (r) => r.structural.low.vpdMean.toFixed(3) },
  { header: 'High veg volume', get: (r) => r.structural.high.volume.toFixed(2) },
  { header: 'High veg active cells', get: (r) => r.structural.high.activeCells },
  { header: 'High veg RH95 mean (m)', get: (r) => r.structural.high.rh95Mean.toFixed(2) },
  { header: 'High veg RH95 max (m)', get: (r) => r.structural.high.rh95Max.toFixed(2) },
  { header: 'High veg NL mean', get: (r) => r.structural.high.nlMean.toFixed(3) },
  { header: 'High veg VPD mean', get: (r) => r.structural.high.vpdMean.toFixed(3) },
  { header: 'Connectivity - whole scene (%)', get: (r) => (r.connectivity.wholeScenePc * 100).toFixed(2) },
  { header: 'Connectivity - turf only (%)', get: (r) => (r.connectivity.turfPc * 100).toFixed(2) },
  { header: 'Connectivity - shrubs only (%)', get: (r) => (r.connectivity.shrubPc * 100).toFixed(2) },
  { header: 'Connectivity - trees only (%)', get: (r) => (r.connectivity.treePc * 100).toFixed(2) },
  { header: 'Connectivity patch count', get: (r) => r.connectivity.patchCount },
  { header: 'Score total', get: (r) => r.score.total },
  { header: 'Score (%)', get: (r) => r.score.percentage },
]

function csvEscape(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function scenariosToCsv(records: ScenarioRecord[]): string {
  const header = CSV_COLUMNS.map((column) => csvEscape(column.header)).join(',')
  const rows = records.map((record) => CSV_COLUMNS.map((column) => csvEscape(column.get(record))).join(','))
  return [header, ...rows].join('\n')
}

export function downloadScenarioHistoryCsv(records: ScenarioRecord[]) {
  const csv = scenariosToCsv(records)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `scenario-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
