import type { HeightBand, HeightBandId } from '../../types/voxel'

// The 3.50m line is the only dividing line that matters: below = low vegetation, at/above = high vegetation.
export const LOW_VEG_MAX = 3.5

export const HEIGHT_BANDS: HeightBand[] = [
  { id: 1, name: 'Turf', min: 0, max: 0.1, color: '#a2d86a' },
  { id: 2, name: 'Very low', min: 0.1, max: 0.5, color: '#c8e6a0' },
  { id: 3, name: 'Low veg / hedge', min: 0.5, max: 2.0, color: '#4bab67' },
  { id: 4, name: 'Medium vegetation', min: 2.0, max: LOW_VEG_MAX, color: '#2a8b4e' },
  { id: 5, name: 'High vegetation', min: LOW_VEG_MAX, max: Infinity, color: '#1f5f38' },
]

export function classifyHeightBand(z: number): HeightBandId {
  for (const band of HEIGHT_BANDS) {
    if (z >= band.min && z < band.max) return band.id
  }
  return z >= LOW_VEG_MAX ? 5 : 1
}

export function isLowVegetation(z: number): boolean {
  return z >= 0.1 && z < LOW_VEG_MAX
}

export function isHighVegetation(z: number): boolean {
  return z >= LOW_VEG_MAX
}
