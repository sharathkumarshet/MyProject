import type { CanopyVoxel } from '../../types/voxel'
import { classifyHeightBand } from './bands'
import { sampleCanopyCount } from './bootstrap'

const SLAB = 0.5

interface ShrubInput {
  id: string
  x: number
  y: number
  height: number
}

// A shrub is a single rounded blob from the ground up, tapering at both the base and the top.
export function generateShrubCanopyVoxels(shrub: ShrubInput, rng: () => number): CanopyVoxel[] {
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
