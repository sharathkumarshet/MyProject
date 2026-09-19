export type HeightBandId = 1 | 2 | 3 | 4 | 5

export interface HeightBand {
  id: HeightBandId
  name: string
  min: number
  max: number
  color: string
}

export type TreeCrownShape = 'mango' | 'rain-tree' | 'palm'

// Canopy voxel: 1m x 1m footprint, 0.5m tall slab. Used for every non-turf plant (shrubs/trees).
export interface CanopyVoxel {
  x: number
  y: number
  z: number
  count: number
  band: HeightBandId
  source: 'shrub' | 'tree-trunk' | 'tree-crown'
  sourceId: string
}

// Turf voxel: 1m x 1m footprint, fixed 0.1m tall, never stacked.
export interface TurfVoxel {
  x: number
  y: number
  count: number
  patchIndex: number
}
