import type { CanopyVoxel, ShrubCrownShape } from '../../types/voxel'
import { classifyHeightBand } from './bands'
import { sampleCanopyCount } from './bootstrap'

const SLAB = 0.5

interface ShrubInput {
  id: string
  x: number
  y: number
  height: number
  crownShape: ShrubCrownShape
}

// Temperate shrub tier: a short stepped-pyramid pine — same grid-aligned square-layer logic as
// the tree conifer, just fewer layers and a narrower base so it reads as low as a shrub.
function generatePineShrubVoxels(shrub: ShrubInput, rng: () => number): CanopyVoxel[] {
  const voxels: CanopyVoxel[] = []
  const cellX = Math.round(shrub.x)
  const cellY = Math.round(shrub.y)
  const layerCount = Math.max(1, Math.round(shrub.height / SLAB))
  const baseRadius = Math.max(1, Math.round(shrub.height * 0.55))

  for (let layer = 0; layer < layerCount; layer += 1) {
    const z = layer * SLAB
    const progress = layerCount === 1 ? 1 : layer / (layerCount - 1)
    const radius = Math.max(0, Math.round(baseRadius * (1 - progress)))
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue
        voxels.push({
          x: cellX + dx,
          y: cellY + dy,
          z,
          count: sampleCanopyCount(rng),
          band: classifyHeightBand(z + SLAB / 2),
          source: 'shrub',
          sourceId: shrub.id,
        })
      }
    }
  }

  return voxels
}

// A shrub is a single rounded blob from the ground up, tapering at both the base and the top.
export function generateShrubCanopyVoxels(shrub: ShrubInput, rng: () => number): CanopyVoxel[] {
  if (shrub.crownShape === 'pine') return generatePineShrubVoxels(shrub, rng)

  const voxels: CanopyVoxel[] = []
  const cellX = Math.round(shrub.x)
  const cellY = Math.round(shrub.y)
  const maxRadius = Math.min(1.6, Math.max(0.4, shrub.height * 0.5))
  const halfHeight = Math.max(SLAB / 2, shrub.height / 2)

  for (let z = 0; z <= shrub.height; z += SLAB) {
    const normalized = Math.min(1, Math.abs(z - halfHeight) / halfHeight)
    const radius = maxRadius * Math.sqrt(Math.max(0, 1 - normalized * normalized))
    const cellRadius = Math.max(0, Math.round(radius))

    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        if (dx * dx + dy * dy > radius * radius) continue
        voxels.push({
          x: cellX + dx,
          y: cellY + dy,
          z,
          count: sampleCanopyCount(rng),
          band: classifyHeightBand(z + SLAB / 2),
          source: 'shrub',
          sourceId: shrub.id,
        })
      }
    }
  }

  return voxels
}
