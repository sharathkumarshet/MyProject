import type { GeneratedLandscape } from '../../types/landscape'
import type { StructuralBandMetrics, StructuralMetrics, TurfMetrics } from '../../types/metrics'
import type { CanopyVoxel } from '../../types/voxel'
import { LOW_VEG_MAX } from '../voxel/bands'
import { buildMask, labelPatches } from './raster'

const CELL_SIZE = 5
const HIST_BIN = 1

function normalize(hist: number[]): number[] {
  const total = hist.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return hist.map(() => 0)
  return hist.map((value) => value / total)
}

// Jensen-Shannon divergence between two normalized height histograms.
function jsDivergence(p: number[], q: number[]): number {
  const m = p.map((value, index) => (value + q[index]) / 2)
  const kl = (a: number[], b: number[]) =>
    a.reduce((sum, value, index) => (value > 0 && b[index] > 0 ? sum + value * Math.log2(value / b[index]) : sum), 0)
  return 0.5 * kl(p, m) + 0.5 * kl(q, m)
}

// numpy.percentile-style linear interpolation.
function percentile95(sorted: number[]): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const position = 0.95 * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

// Light 3-tap gaussian-ish smoothing over the 1m-bin vertical histogram.
function smoothHistogram(hist: number[]): number[] {
  return hist.map((value, index) => {
    const prev = index > 0 ? hist[index - 1] : value
    const next = index < hist.length - 1 ? hist[index + 1] : value
    return 0.25 * prev + 0.5 * value + 0.25 * next
  })
}

// Count peaks that are >=5% of the tallest peak and >=2 bins apart from the previous peak.
function countPeaks(hist: number[]): number {
  const maxValue = Math.max(0, ...hist)
  if (maxValue <= 0) return 0
  const threshold = maxValue * 0.05
  const peaks: number[] = []

  for (let i = 0; i < hist.length; i += 1) {
    if (hist[i] < threshold) continue
    const isLocalPeak = (i === 0 || hist[i] >= hist[i - 1]) && (i === hist.length - 1 || hist[i] >= hist[i + 1])
    if (!isLocalPeak) continue

    const last = peaks[peaks.length - 1]
    if (last === undefined || i - last >= 2) {
      peaks.push(i)
    } else if (hist[i] > hist[last]) {
      peaks[peaks.length - 1] = i
    }
  }

  return peaks.length
}

function computeBand(voxels: CanopyVoxel[], width: number, length: number, bandMin: number, bandMax: number): StructuralBandMetrics {
  const cols = Math.max(1, Math.ceil(width / CELL_SIZE))
  const rows = Math.max(1, Math.ceil(length / CELL_SIZE))
  const bins = Math.max(1, Math.ceil((Math.min(bandMax, bandMin + 20) - bandMin) / HIST_BIN))

  const cellVolume = new Array(cols * rows).fill(0)
  const cellHeights: number[][] = Array.from({ length: cols * rows }, () => [])
  const cellHistograms: number[][] = Array.from({ length: cols * rows }, () => new Array(bins).fill(0))

  for (const voxel of voxels) {
    if (voxel.z < bandMin || voxel.z >= bandMax) continue
    const col = Math.min(cols - 1, Math.max(0, Math.floor(voxel.x / CELL_SIZE)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(voxel.y / CELL_SIZE)))
    const index = row * cols + col

    cellVolume[index] += voxel.count
    cellHeights[index].push(voxel.z)
    const bin = Math.min(bins - 1, Math.max(0, Math.floor((voxel.z - bandMin) / HIST_BIN)))
    cellHistograms[index][bin] += 1
  }

  const normalizedHistograms = cellHistograms.map(normalize)

  let activeCells = 0
  let rh95Sum = 0
  let rh95Max = 0
  let nlSum = 0
  let vpdSum = 0

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col
      const heights = cellHeights[index]
      if (heights.length === 0) continue
      activeCells += 1

      const rh95 = percentile95([...heights].sort((a, b) => a - b))
      rh95Sum += rh95
      rh95Max = Math.max(rh95Max, rh95)

      nlSum += Math.max(1, countPeaks(smoothHistogram(cellHistograms[index])))

      let neighborCount = 0
      let vpd = 0
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue
          const nr = row + dr
          const nc = col + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const neighborIndex = nr * cols + nc
          if (cellHeights[neighborIndex].length === 0) continue
          vpd += jsDivergence(normalizedHistograms[index], normalizedHistograms[neighborIndex])
          neighborCount += 1
        }
      }
      vpdSum += neighborCount > 0 ? vpd / neighborCount : 0
    }
  }

  return {
    volume: Number(cellVolume.reduce((sum, value) => sum + value, 0).toFixed(1)),
    activeCells,
    rh95Mean: activeCells > 0 ? Number((rh95Sum / activeCells).toFixed(2)) : 0,
    rh95Max: Number(rh95Max.toFixed(2)),
    nlMean: activeCells > 0 ? Number((nlSum / activeCells).toFixed(2)) : 0,
    vpdMean: activeCells > 0 ? Number((vpdSum / activeCells).toFixed(3)) : 0,
  }
}

export function computeStructuralMetrics(generated: GeneratedLandscape, width: number, length: number): StructuralMetrics {
  return {
    low: computeBand(generated.canopyVoxels, width, length, 0.1, LOW_VEG_MAX),
    high: computeBand(generated.canopyVoxels, width, length, LOW_VEG_MAX, Infinity),
  }
}

export function computeTurfMetrics(generated: GeneratedLandscape, width: number, length: number): TurfMetrics {
  const cols = Math.max(1, Math.round(width))
  const rows = Math.max(1, Math.round(length))
  const mask = buildMask(generated.turfVoxels, cols, rows)
  const { patches } = labelPatches(mask, cols, rows)

  // Each turf voxel is exactly one occupied 1m x 1m x 0.1m slice — coverage_m2 and volume follow directly.
  const coverageM2 = generated.turfVoxels.length
  const turfVolumeM3 = coverageM2 * 0.1

  return {
    coverageM2: Number(coverageM2.toFixed(1)),
    turfVolumeM3: Number(turfVolumeM3.toFixed(1)),
    patchCount: patches.length,
    largestPatchM2: patches.length > 0 ? Math.max(...patches.map((patch) => patch.cells)) : 0,
  }
}
