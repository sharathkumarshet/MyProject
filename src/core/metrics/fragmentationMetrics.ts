import type { GeneratedLandscape } from '../../types/landscape'
import type { FragmentationLayerMetrics, FragmentationMetrics } from '../../types/metrics'
import { layerMask } from './connectivity'
import { labelPatches } from './raster'

interface RawLayerStats {
  n: number
  patchDensity: number
  edgeDensity: number
  lpi: number
  meanPatchArea: number
}

// Sum of cell-boundary sides where a class cell touches a non-class cell (or the outer scene edge).
// Only checks right/down neighbors so each shared side is counted once; scene-boundary sides count too.
function countEdgeLength(mask: Uint8Array, cols: number, rows: number): number {
  let edges = 0
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x
      const value = mask[index]
      const rightDiffers = x === cols - 1 ? value === 1 : mask[index + 1] !== value
      if (rightDiffers) edges += 1
      const downDiffers = y === rows - 1 ? value === 1 : mask[index + cols] !== value
      if (downDiffers) edges += 1
    }
  }
  return edges
}

function computeLayerRaw(mask: Uint8Array, cols: number, rows: number, landscapeArea: number): RawLayerStats {
  const { patches } = labelPatches(mask, cols, rows)
  const n = patches.length
  const edgeLength = countEdgeLength(mask, cols, rows)
  const areas = patches.map((patch) => patch.cells)
  const maxArea = areas.length > 0 ? Math.max(...areas) : 0
  const totalArea = areas.reduce((sum, value) => sum + value, 0)

  return {
    n,
    patchDensity: landscapeArea > 0 ? (n / landscapeArea) * 100 : 0,
    edgeDensity: landscapeArea > 0 ? edgeLength / landscapeArea : 0,
    lpi: landscapeArea > 0 ? (maxArea / landscapeArea) * 100 : 0,
    meanPatchArea: n > 0 ? totalArea / n : 0,
  }
}

function normalize(value: number, min: number, max: number): number {
  if (max - min <= 1e-9) return 0
  return (value - min) / (max - min)
}

// FFI is min-max normalized against the 4 layers of this scene (turf, shrub, tree, overall) — not an absolute number.
export function computeFragmentation(generated: GeneratedLandscape, width: number, length: number): FragmentationMetrics {
  const cols = Math.max(1, Math.round(width))
  const rows = Math.max(1, Math.round(length))
  const landscapeArea = cols * rows

  const raw = {
    turf: computeLayerRaw(layerMask(generated, 'turf', cols, rows), cols, rows, landscapeArea),
    shrub: computeLayerRaw(layerMask(generated, 'shrub', cols, rows), cols, rows, landscapeArea),
    tree: computeLayerRaw(layerMask(generated, 'tree', cols, rows), cols, rows, landscapeArea),
    overall: computeLayerRaw(layerMask(generated, 'all', cols, rows), cols, rows, landscapeArea),
  }

  const layers = Object.values(raw)
  const invMpa = (r: RawLayerStats) => (r.meanPatchArea > 0 ? 1 / r.meanPatchArea : 0)
  const edValues = layers.map((r) => r.edgeDensity)
  const pdValues = layers.map((r) => r.patchDensity)
  const invMpaValues = layers.map(invMpa)
  const edMin = Math.min(...edValues)
  const edMax = Math.max(...edValues)
  const pdMin = Math.min(...pdValues)
  const pdMax = Math.max(...pdValues)
  const invMpaMin = Math.min(...invMpaValues)
  const invMpaMax = Math.max(...invMpaValues)

  const toLayerMetrics = (r: RawLayerStats): FragmentationLayerMetrics => {
    const edNorm = normalize(r.edgeDensity, edMin, edMax)
    const pdNorm = normalize(r.patchDensity, pdMin, pdMax)
    const invMpaNorm = normalize(invMpa(r), invMpaMin, invMpaMax)
    const fragmentationIndex = (edNorm + pdNorm + invMpaNorm) / 3

    return {
      patchCount: r.n,
      patchDensity: Number(r.patchDensity.toFixed(4)),
      edgeDensity: Number(r.edgeDensity.toFixed(4)),
      largestPatchIndex: Number(r.lpi.toFixed(2)),
      meanPatchAreaM2: Number(r.meanPatchArea.toFixed(2)),
      fragmentationIndex: Number(fragmentationIndex.toFixed(3)),
    }
  }

  return {
    patchDensityUnit: 'patches / 100 m²',
    edgeDensityUnit: 'm edge / m² scene',
    turf: toLayerMetrics(raw.turf),
    shrub: toLayerMetrics(raw.shrub),
    tree: toLayerMetrics(raw.tree),
    overall: toLayerMetrics(raw.overall),
  }
}
