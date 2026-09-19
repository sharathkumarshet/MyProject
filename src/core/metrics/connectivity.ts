import type { GeneratedLandscape } from '../../types/landscape'
import type { ConnectivityMetrics, ConnectivityPatch, ConnectivityPatchRef } from '../../types/metrics'
import { classifyPatchesByPcFlux } from './pcFluxClasses'
import { buildMask, labelPatches, unionMasks, type RasterPatch } from './raster'

// Distance (m) at which crossing probability drops to 50%.
const D50 = 50
const FLOYD_WARSHALL_CAP = 300
// Only the largest N patches get a real (expensive) dPC value; the rest are "not tested".
const DPC_TOP_N = 10

type Layer = 'turf' | 'shrub' | 'tree' | 'all'

function layerMask(generated: GeneratedLandscape, layer: Layer, cols: number, rows: number): Uint8Array {
  if (layer === 'turf') return buildMask(generated.turfVoxels, cols, rows)
  if (layer === 'shrub') return buildMask(generated.canopyVoxels.filter((voxel) => voxel.source === 'shrub'), cols, rows)
  if (layer === 'tree') {
    return buildMask(
      generated.canopyVoxels.filter((voxel) => voxel.source === 'tree-trunk' || voxel.source === 'tree-crown'),
      cols,
      rows,
    )
  }
  return unionMasks(
    [layerMask(generated, 'turf', cols, rows), layerMask(generated, 'shrub', cols, rows), layerMask(generated, 'tree', cols, rows)],
    cols * rows,
  )
}

// -log(p) edge weights + Floyd-Warshall = highest-probability path, allowed to hop through stepping-stone patches.
function computeBestPath(patches: RasterPatch[]): number[][] {
  const n = patches.length
  const k = Math.log(2) / D50
  const cost: number[][] = Array.from({ length: n }, () => new Array(n).fill(Infinity))

  for (let i = 0; i < n; i += 1) {
    cost[i][i] = 0
    for (let j = i + 1; j < n; j += 1) {
      const distance = Math.hypot(patches[i].cx - patches[j].cx, patches[i].cy - patches[j].cy)
      const p = Math.exp(-k * distance)
      const edgeCost = -Math.log(Math.max(p, 1e-12))
      cost[i][j] = edgeCost
      cost[j][i] = edgeCost
    }
  }

  // Above the cap, skip stepping-stone rerouting and use direct decay only (keeps compute bounded).
  if (n <= FLOYD_WARSHALL_CAP) {
    for (let mid = 0; mid < n; mid += 1) {
      for (let i = 0; i < n; i += 1) {
        if (cost[i][mid] === Infinity) continue
        for (let j = 0; j < n; j += 1) {
          const through = cost[i][mid] + cost[mid][j]
          if (through < cost[i][j]) cost[i][j] = through
        }
      }
    }
  }

  return cost.map((row) => row.map((value) => Math.exp(-value)))
}

// PC = sum(a_i * a_j * bestPath(i,j)) / landscapeArea^2, self-pairs included (bestPath(i,i) = 1).
function computePc(patches: RasterPatch[], bestP: number[][], landscapeArea: number): number {
  const n = patches.length
  if (n === 0 || landscapeArea <= 0) return 0

  let sum = 0
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      sum += patches[i].cells * patches[j].cells * bestP[i][j]
    }
  }
  return sum / (landscapeArea * landscapeArea)
}

function pcForLayer(generated: GeneratedLandscape, layer: 'turf' | 'shrub' | 'tree', cols: number, rows: number, landscapeArea: number): number {
  const { patches } = labelPatches(layerMask(generated, layer, cols, rows), cols, rows)
  const bestP = computeBestPath(patches)
  return computePc(patches, bestP, landscapeArea)
}

// Removing a patch strips every edge touching it, so its stepping-stone routes must be recomputed from scratch — expensive.
function computeDPc(patches: RasterPatch[], landscapeArea: number, wholeScenePc: number, patchIndex: number): number {
  const remaining = patches.filter((_, index) => index !== patchIndex)
  const remainingBestP = computeBestPath(remaining)
  const pcWithoutPatch = computePc(remaining, remainingBestP, landscapeArea)
  return wholeScenePc > 0 ? (100 * (wholeScenePc - pcWithoutPatch)) / wholeScenePc : 0
}

function buildMembersByPatch(generated: GeneratedLandscape, labels: Int32Array, cols: number): Map<number, ConnectivityPatchRef[]> {
  const membersByPatch = new Map<number, ConnectivityPatchRef[]>()
  const addMember = (patchId: number, ref: ConnectivityPatchRef) => {
    if (patchId < 0) return
    const list = membersByPatch.get(patchId) ?? []
    list.push(ref)
    membersByPatch.set(patchId, list)
  }

  generated.trees.forEach((tree, index) => {
    const cellIndex = Math.round(tree.y) * cols + Math.round(tree.x)
    addMember(labels[cellIndex], { type: 'tree', index })
  })
  generated.shrubs.forEach((shrub, index) => {
    const cellIndex = Math.round(shrub.y) * cols + Math.round(shrub.x)
    addMember(labels[cellIndex], { type: 'shrub', index })
  })

  const turfPatchIndicesByPatchId = new Map<number, Set<number>>()
  for (const voxel of generated.turfVoxels) {
    const cellIndex = voxel.y * cols + voxel.x
    const patchId = labels[cellIndex]
    if (patchId < 0) continue
    const seen = turfPatchIndicesByPatchId.get(patchId) ?? new Set<number>()
    seen.add(voxel.patchIndex)
    turfPatchIndicesByPatchId.set(patchId, seen)
  }
  turfPatchIndicesByPatchId.forEach((indices, patchId) => {
    indices.forEach((index) => addMember(patchId, { type: 'turf', index }))
  })

  return membersByPatch
}

export function computeConnectivity(generated: GeneratedLandscape, width: number, length: number): ConnectivityMetrics {
  const cols = Math.max(1, Math.round(width))
  const rows = Math.max(1, Math.round(length))
  const landscapeArea = cols * rows

  const { patches: rawPatches, labels } = labelPatches(layerMask(generated, 'all', cols, rows), cols, rows)
  const bestP = computeBestPath(rawPatches)
  const wholeScenePc = computePc(rawPatches, bestP, landscapeArea)
  const membersByPatch = buildMembersByPatch(generated, labels, cols)

  // Largest-N patches first, so the expensive dPC recomputation only ever runs on the patches that matter most.
  const byAreaDesc = [...rawPatches].sort((a, b) => b.cells - a.cells)
  const dpcEligible = new Set(byAreaDesc.slice(0, DPC_TOP_N).map((patch) => patch.id))

  const withFlux = rawPatches.map((patch) => {
    let crossTerm = 0
    for (let j = 0; j < rawPatches.length; j += 1) {
      if (j === patch.id) continue
      crossTerm += rawPatches[j].cells * bestP[patch.id][j]
    }
    // PC_flux = area(j) * sum_{i != j}(area(i) * bestPath(i,j)) / landscapeArea^2 — no self term, no doubling.
    const pcFlux = landscapeArea > 0 ? (patch.cells * crossTerm) / (landscapeArea * landscapeArea) : 0
    const dPC = dpcEligible.has(patch.id) ? computeDPc(rawPatches, landscapeArea, wholeScenePc, patch.id) : null

    const result: ConnectivityPatch = {
      id: patch.id,
      area: patch.cells,
      cx: patch.cx,
      cy: patch.cy,
      pcFlux,
      dPC,
      importanceRelative: 0,
      importanceLevel: 1,
      members: membersByPatch.get(patch.id) ?? [],
    }
    return result
  })

  const patches = classifyPatchesByPcFlux(withFlux).sort((a, b) => b.pcFlux - a.pcFlux)

  return {
    wholeScenePc,
    turfPc: pcForLayer(generated, 'turf', cols, rows, landscapeArea),
    shrubPc: pcForLayer(generated, 'shrub', cols, rows, landscapeArea),
    treePc: pcForLayer(generated, 'tree', cols, rows, landscapeArea),
    patches,
  }
}
