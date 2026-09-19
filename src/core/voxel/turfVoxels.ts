import type { TurfVoxel } from '../../types/voxel'
import { sampleTurfCount } from './bootstrap'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function insideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

// Rasterizes turf patches to 1m cells, excluding anywhere a building or road occupies.
export function generateTurfVoxels(
  turfPatches: Rect[],
  buildings: Rect[],
  roads: Rect[],
  width: number,
  length: number,
  rng: () => number,
): TurfVoxel[] {
  const voxels: TurfVoxel[] = []

  for (let cx = 0; cx < Math.round(width); cx += 1) {
    for (let cy = 0; cy < Math.round(length); cy += 1) {
      const x = cx + 0.5
      const y = cy + 0.5

      const patchIndex = turfPatches.findIndex((patch) => insideRect(x, y, patch))
      if (patchIndex === -1) continue

      const blocked = buildings.some((building) => insideRect(x, y, building)) || roads.some((road) => insideRect(x, y, road))
      if (blocked) continue

      voxels.push({ x: cx, y: cy, count: sampleTurfCount(rng), patchIndex })
    }
  }

  return voxels
}
