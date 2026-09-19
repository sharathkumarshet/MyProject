import type { CanopyVoxel, TreeCrownShape } from '../../types/voxel'
import { classifyHeightBand } from './bands'
import { sampleCanopyCount } from './bootstrap'

const SLAB = 0.5

interface TreeInput {
  id: string
  x: number
  y: number
  height: number
  crownShape: TreeCrownShape
}

function voxelNoise(treeId: string, dx: number, dy: number, layer: number) {
  let hash = layer * 374761393 + dx * 668265263 + dy * 2147483647
  for (let i = 0; i < treeId.length; i += 1) {
    hash = (hash ^ treeId.charCodeAt(i)) * 1274126177
  }
  const value = Math.sin(hash) * 43758.5453123
  return value - Math.floor(value)
}

function crownProfile(shape: TreeCrownShape, height: number, crownBase: number) {
  const crownHeight = Math.max(SLAB, height - crownBase)
  const mid = crownBase + crownHeight / 2

  if (shape === 'rain-tree') {
    // Wide umbrella canopy, but keep a slight dome so the top does not read as a cut-off slab.
    const maxRadius = Math.min(3.2, Math.max(1.2, crownHeight * 1.3))
    return (z: number) => {
      const t = Math.min(1, Math.max(0, (z - crownBase) / crownHeight))
      if (t < 0.3) return maxRadius * (0.35 + 0.65 * (t / 0.3))
      if (t < 0.8) return maxRadius * (0.96 + 0.08 * Math.sin((t - 0.3) / 0.5 * Math.PI))
      return maxRadius * (1 - (t - 0.8) * 0.35)
    }
  }

  if (shape === 'palm') {
    // Palm crowns still need a visible canopy spread so they never read as a bare pole.
    const maxRadius = Math.min(2.4, Math.max(1.4, crownHeight * 1.05))
    return (z: number) => {
      const normalized = Math.min(1, Math.max(0, (z - crownBase) / crownHeight))
      const fan = normalized < 0.55 ? 0.75 + normalized * 0.35 : 1.1 - (normalized - 0.55) * 0.35
      return maxRadius * Math.max(0.7, fan)
    }
  }

  // mango: rounded/oval crown.
  const maxRadius = Math.min(2.6, Math.max(0.8, crownHeight * 0.55))
  const halfHeight = crownHeight / 2
  return (z: number) => {
    const normalized = Math.min(1, Math.abs(z - mid) / halfHeight)
    return maxRadius * Math.sqrt(Math.max(0, 1 - normalized * normalized))
  }
}

export function generateTreeCanopyVoxels(tree: TreeInput, rng: () => number): CanopyVoxel[] {
  const voxels: CanopyVoxel[] = []
  const cellX = Math.round(tree.x)
  const cellY = Math.round(tree.y)

  const crownBase =
    tree.crownShape === 'palm' ? tree.height * 0.92 : tree.crownShape === 'rain-tree' ? tree.height * 0.6 : tree.height * 0.45
  let topCrownZ = crownBase

  // Trunk: thin column of canopy voxels from the ground up to the crown base — never skipped.
  for (let z = 0; z < crownBase; z += SLAB) {
    voxels.push({
      x: cellX,
      y: cellY,
      z,
      count: sampleCanopyCount(rng),
      band: classifyHeightBand(z + SLAB / 2),
      source: 'tree-trunk',
      sourceId: tree.id,
    })
  }

  const radiusAt = crownProfile(tree.crownShape, tree.height, crownBase)
  for (let z = crownBase; z <= tree.height; z += SLAB) {
    const layer = Math.round(z / SLAB)
    const layerProgress = Math.min(1, Math.max(0, (z - crownBase) / Math.max(SLAB, tree.height - crownBase)))
    const radius = radiusAt(z)
    const texturedRadius = radius * (0.9 + voxelNoise(tree.id, 0, 0, layer) * 0.22)
    const cellRadius = Math.max(1, Math.round(texturedRadius + (layerProgress > 0.75 ? 0.35 : 0)))
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const noise = voxelNoise(tree.id, dx, dy, layer)
        const distance = Math.sqrt(dx * dx + dy * dy)
        const edgeRadius = texturedRadius + (noise - 0.5) * 0.45 + (layerProgress > 0.7 ? 0.18 : 0)
        const solidCoreRadius = Math.max(0.95, texturedRadius - 0.18)
        const shellStart = Math.max(0.9, solidCoreRadius - 0.25)
        const shouldKeepCore = distance <= solidCoreRadius
        const shouldKeepEdge = distance <= edgeRadius && (distance <= shellStart || noise > (layerProgress > 0.8 ? 0.1 : 0.18))
        if (!shouldKeepCore && !shouldKeepEdge) continue
        voxels.push({
          x: cellX + dx,
          y: cellY + dy,
          z,
          count: sampleCanopyCount(rng),
          band: classifyHeightBand(z + SLAB / 2),
          source: 'tree-crown',
          sourceId: tree.id,
        })
        topCrownZ = z
      }
    }
  }

  const supportKeys = new Set(
    voxels
      .filter((voxel) => voxel.source === 'tree-crown' && Math.abs(voxel.z - topCrownZ) < 1e-9)
      .map((voxel) => `${voxel.x},${voxel.y}`),
  )

  const capHeight = topCrownZ + SLAB
  const capLayer = Math.round(capHeight / SLAB)
  const capRadius = tree.crownShape === 'palm' ? 2 : tree.crownShape === 'rain-tree' ? 2 : 1.5
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dy = -2; dy <= 2; dy += 1) {
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > capRadius) continue
      const hasSupport =
        supportKeys.has(`${cellX + dx},${cellY + dy}`) ||
        supportKeys.has(`${cellX + dx - 1},${cellY + dy}`) ||
        supportKeys.has(`${cellX + dx + 1},${cellY + dy}`) ||
        supportKeys.has(`${cellX + dx},${cellY + dy - 1}`) ||
        supportKeys.has(`${cellX + dx},${cellY + dy + 1}`)
      if (!hasSupport) continue
      const noise = voxelNoise(tree.id, dx, dy, capLayer)
      const keep = distance <= 1.15 || noise > 0.4 - distance * 0.08
      if (!keep) continue
      voxels.push({
        x: cellX + dx,
        y: cellY + dy,
        z: capHeight,
        count: sampleCanopyCount(rng),
        band: classifyHeightBand(capHeight + SLAB / 2),
        source: 'tree-crown',
        sourceId: tree.id,
      })
    }
  }

  return voxels
}
