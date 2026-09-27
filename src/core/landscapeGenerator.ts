import type { BuildingItem, GeneratedLandscape, LandscapeConfig, ShrubItem, TreeItem, TurfPatch } from '../types/landscape'
import type { CanopyVoxel, ShrubCrownShape, TreeCrownShape } from '../types/voxel'
import { DEFAULT_CONFIG } from '../config/defaults'
import { createRng } from './rng'
import { getZones } from './zones'
import { generateTreeCanopyVoxels } from './voxel/treeVoxels'
import { generateShrubCanopyVoxels } from './voxel/shrubVoxels'
import { generateTurfVoxels } from './voxel/turfVoxels'

const TROPICAL_TREE_SHAPES: TreeCrownShape[] = ['mango', 'rain-tree', 'palm']
const TEMPERATE_TREE_SHAPES: TreeCrownShape[] = ['pine', 'oak', 'spruce']

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: { x: number; y: number; width: number; height: number }, gap = 0) {
  const nearestX = clamp(x, rect.x, rect.x + rect.width)
  const nearestY = clamp(y, rect.y, rect.y + rect.height)
  const dx = x - nearestX
  const dy = y - nearestY
  const limit = radius + gap
  return dx * dx + dy * dy < limit * limit
}

function circlesOverlap(x: number, y: number, radius: number, circles: Array<{ x: number; y: number; radius: number }>, gap = 0) {
  return circles.some((circle) => {
    const dx = x - circle.x
    const dy = y - circle.y
    const limit = radius + circle.radius + gap
    return dx * dx + dy * dy < limit * limit
  })
}

function isCircleBlocked(
  x: number,
  y: number,
  radius: number,
  blockedRects: Array<{ x: number; y: number; width: number; height: number }>,
  blockedCircles: Array<{ x: number; y: number; radius: number }>,
) {
  return blockedRects.some((rect) => circleIntersectsRect(x, y, radius, rect, 0.25)) || circlesOverlap(x, y, radius, blockedCircles, 0.35)
}

function findFreeCirclePoint(
  width: number,
  length: number,
  radius: number,
  blockedRects: Array<{ x: number; y: number; width: number; height: number }>,
  blockedCircles: Array<{ x: number; y: number; radius: number }>,
  preferredPoint?: { x: number; y: number },
) {
  const minX = radius + 0.2
  const minY = radius + 0.2
  const maxX = width - radius - 0.2
  const maxY = length - radius - 0.2

  // Search outward in expanding rings from the pattern's intended point so overflow items settle nearby
  // (staying inside their cluster/line), instead of always collapsing into whichever spot is first in raster
  // order from the top-left corner.
  if (preferredPoint) {
    const step = Math.max(0.5, radius)
    const maxRadius = Math.max(width, length)
    for (let ring = 0; ring * step <= maxRadius; ring += 1) {
      const ringRadius = ring * step
      const samples = ring === 0 ? 1 : Math.max(8, Math.round(ring * 6))
      for (let s = 0; s < samples; s += 1) {
        const angle = (Math.PI * 2 * s) / samples
        const x = clamp(preferredPoint.x + Math.cos(angle) * ringRadius, minX, maxX)
        const y = clamp(preferredPoint.y + Math.sin(angle) * ringRadius, minY, maxY)
        if (!isCircleBlocked(x, y, radius, blockedRects, blockedCircles)) {
          return { x, y }
        }
      }
    }
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isCircleBlocked(x, y, radius, blockedRects, blockedCircles)) {
        return { x, y }
      }
    }
  }

  // Density has genuinely exceeded what fits with clearance between items — better to let canopies sit a
  // little close than to place one on top of a road/building, which the site plan must never allow.
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!blockedRects.some((rect) => circleIntersectsRect(x, y, radius, rect, 0.25))) {
        return { x, y }
      }
    }
  }

  return {
    x: clamp(width / 2, minX, maxX),
    y: clamp(length / 2, minY, maxY),
  }
}

function treeFootprintRadius(height: number, crownShape: TreeCrownShape) {
  if (crownShape === 'pine' || crownShape === 'spruce') {
    const crownBase = crownShape === 'spruce' ? height * 0.15 : height * 0.25
    const crownHeight = Math.max(0.5, height - crownBase)
    return Math.max(1, crownHeight * (crownShape === 'spruce' ? 0.22 : 0.32))
  }
  if (crownShape === 'oak') {
    const crownHeight = Math.max(0.5, height - height * 0.5)
    return Math.min(3.4, Math.max(1.4, crownHeight * 0.9))
  }
  const crownBase = crownShape === 'palm' ? height * 0.92 : crownShape === 'rain-tree' ? height * 0.6 : height * 0.45
  const crownHeight = Math.max(0.5, height - crownBase)
  if (crownShape === 'rain-tree') return Math.min(3.2, Math.max(1.2, crownHeight * 1.3))
  if (crownShape === 'palm') return Math.min(2.4, Math.max(1.4, crownHeight * 1.05))
  return Math.min(2.6, Math.max(0.8, crownHeight * 0.55))
}

function shrubFootprintRadius(height: number, crownShape: ShrubCrownShape) {
  if (crownShape === 'pine') return Math.min(1.8, Math.max(0.5, height * 0.55))
  return Math.min(1.6, Math.max(0.4, height * 0.5))
}

// Number of cluster blobs to spread across the site, scaled with item count (kept small so it still reads as "clusters", not scatter).
function clusterCount(count: number) {
  return Math.min(6, Math.max(3, Math.round(Math.sqrt(Math.max(1, count) / 3))))
}

// Lays out cluster centres on a grid sized to the site's aspect ratio, so clusters span the full width/length
// (including areas south of any road) instead of a handful of fixed points that only ever cover part of the site.
function clusterCenters(width: number, length: number, count: number) {
  const cols = Math.max(1, Math.round(Math.sqrt((count * width) / Math.max(length, 1))))
  const rows = Math.max(1, Math.ceil(count / cols))
  const centers: Array<{ x: number; y: number; spreadX: number; spreadY: number }> = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (centers.length >= count) break
      centers.push({
        x: width * ((c + 0.5) / cols),
        y: length * ((r + 0.5) / rows),
        spreadX: width / cols,
        spreadY: length / rows,
      })
    }
  }
  return centers
}

function clusteredPoint(index: number, count: number, width: number, length: number, rng: () => number) {
  const centers = clusterCenters(width, length, clusterCount(count))
  const center = centers[index % centers.length]
  const jitterX = (rng() - 0.5) * center.spreadX * 0.5
  const jitterY = (rng() - 0.5) * center.spreadY * 0.5
  return {
    x: clamp(center.x + jitterX, 2, width - 2),
    y: clamp(center.y + jitterY, 2, length - 2),
    zone: 'centre' as const,
  }
}

type RoadRect = { x: number; y: number; width: number; height: number }

// Places items in a line alongside the road network (offset just off the road edge, alternating sides),
// distributing them evenly along each road's length. Falls back to straight grid rows when there are no roads.
function roadLinePoint(
  roads: RoadRect[],
  index: number,
  count: number,
  width: number,
  length: number,
  rng: () => number,
  footprintRadius = 0.6,
): { x: number; y: number; zone: 'left' | 'right' | 'front' | 'back' } {
  if (roads.length > 0) {
    const road = roads[index % roads.length]
    const perRoad = Math.max(1, Math.ceil(count / roads.length))
    const along = ((Math.floor(index / roads.length) + 0.5) / perRoad + rng() * 0.02) % 1
    // Sit just clear of the road edge — enough to avoid overlapping it, not a wide roadside verge.
    const margin = footprintRadius + 0.3 + rng() * 0.2
    const side = index % 2 === 0 ? 1 : -1
    const horizontal = road.width >= road.height

    if (horizontal) {
      const x = clamp(road.x + along * road.width, 2, width - 2)
      const y = clamp(road.y + road.height / 2 + side * (road.height / 2 + margin), 2, length - 2)
      return { x, y, zone: side > 0 ? 'back' : 'front' }
    }

    const y = clamp(road.y + along * road.height, 2, length - 2)
    const x = clamp(road.x + road.width / 2 + side * (road.width / 2 + margin), 2, width - 2)
    return { x, y, zone: side > 0 ? 'right' : 'left' }
  }

  const rows = Math.max(1, Math.round(Math.sqrt(count || 1)))
  const row = Math.floor(index / rows)
  const column = index % rows
  const padding = 6
  const x = padding + ((width - padding * 2) / Math.max(1, rows - 1)) * column + (rng() - 0.5) * 3
  const y = padding + ((length - padding * 2) / Math.max(1, rows - 1)) * row + (rng() - 0.5) * 3
  return { x: clamp(x, 2, width - 2), y: clamp(y, 2, length - 2), zone: row % 2 === 0 ? 'left' : 'right' }
}

function patternPoint(
  pattern: 'random' | 'centre' | 'sides' | 'perimeter',
  index: number,
  count: number,
  width: number,
  length: number,
  rng: () => number,
  roads: RoadRect[] = [],
  footprintRadius = 0.6,
) {
  const cx = width / 2
  const cy = length / 2

  if (pattern === 'centre') {
    return clusteredPoint(index, count, width, length, rng)
  }

  if (pattern === 'perimeter') {
    return roadLinePoint(roads, index, count, width, length, rng, footprintRadius)
  }

  if (pattern === 'sides') {
    const columns = ['left', 'right', 'front', 'back'] as const
    const side = columns[index % columns.length]
    const margin = 6

    if (side === 'left') {
      return {
        x: clamp(margin + rng() * (width * 0.26), 4, width - 4),
        y: clamp(rng() * length, 4, length - 4),
        zone: 'left' as const,
      }
    }

    if (side === 'right') {
      return {
        x: clamp(width - margin - rng() * (width * 0.26), 4, width - 4),
        y: clamp(rng() * length, 4, length - 4),
        zone: 'right' as const,
      }
    }

    if (side === 'front') {
      return {
        x: clamp(rng() * width, 4, width - 4),
        y: clamp(margin + rng() * (length * 0.26), 4, length - 4),
        zone: 'front' as const,
      }
    }

    return {
      x: clamp(rng() * width, 4, width - 4),
      y: clamp(length - margin - rng() * (length * 0.26), 4, length - 4),
      zone: 'back' as const,
    }
  }

  return {
    x: clamp(rng() * width, 4, width - 4),
    y: clamp(rng() * length, 4, length - 4),
    zone: 'other' as const,
  }
}

function patternShrubs(
  pattern: 'random' | 'clustered' | 'linear' | 'border',
  index: number,
  count: number,
  width: number,
  length: number,
  rng: () => number,
  roads: RoadRect[] = [],
  footprintRadius = 0.6,
): { x: number; y: number; zone: 'centre' | 'left' | 'right' | 'front' | 'back' | 'perimeter' | 'other' } {
  if (pattern === 'clustered') {
    return clusteredPoint(index, count, width, length, rng)
  }

  if (pattern === 'linear') {
    return roadLinePoint(roads, index, count, width, length, rng, footprintRadius)
  }

  if (pattern === 'border') {
    const inset = 6
    const edgeType = index % 4
    const edgeX = rng() * (width - inset * 2) + inset
    const edgeY = rng() * (length - inset * 2) + inset

    if (edgeType === 0) return { x: edgeX, y: inset + rng() * 2, zone: 'front' as const }
    if (edgeType === 1) return { x: width - inset - rng() * 2, y: edgeY, zone: 'right' as const }
    if (edgeType === 2) return { x: edgeX, y: length - inset - rng() * 2, zone: 'back' as const }
    return { x: inset + rng() * 2, y: edgeY, zone: 'left' as const }
  }

  return {
    x: clamp(rng() * width, 2, width - 2),
    y: clamp(rng() * length, 2, length - 2),
    zone: 'other' as const,
  }
}

function patternBuildings(
  pattern: 'random' | 'clustered' | 'linear',
  index: number,
  count: number,
  width: number,
  length: number,
  footprintW: number,
  footprintL: number,
  rng: () => number,
) {
  const minX = 4
  const minY = 4
  const maxX = width - footprintW - 4
  const maxY = length - footprintL - 4

  if (pattern === 'linear') {
    const span = Math.max(1, count - 1)
    const horizontal = width >= length
    const t = span === 0 ? 0.5 : index / span
    const lineX = horizontal ? minX + (maxX - minX) * t : width * 0.5 - footprintW * 0.5 + (rng() - 0.5) * 3
    const lineY = horizontal ? length * 0.5 - footprintL * 0.5 + (rng() - 0.5) * 3 : minY + (maxY - minY) * t

    return {
      x: clamp(lineX, minX, Math.max(minX, maxX)),
      y: clamp(lineY, minY, Math.max(minY, maxY)),
    }
  }

  if (pattern === 'random') {
    return {
      x: clamp(rng() * Math.max(1, width - footprintW), minX, Math.max(minX, maxX)),
      y: clamp(rng() * Math.max(1, length - footprintL), minY, Math.max(minY, maxY)),
    }
  }

  const clusters = [
    { x: width * 0.32, y: length * 0.34 },
    { x: width * 0.62, y: length * 0.44 },
    { x: width * 0.5, y: length * 0.68 },
  ]
  const center = clusters[index % clusters.length]
  const spread = Math.max(footprintW, footprintL) * 1.2

  return {
    x: clamp(center.x - footprintW * 0.5 + (rng() - 0.5) * spread, minX, Math.max(minX, maxX)),
    y: clamp(center.y - footprintL * 0.5 + (rng() - 0.5) * spread, minY, Math.max(minY, maxY)),
  }
}

function buildingOverlaps(
  x: number,
  y: number,
  width: number,
  height: number,
  existing: Array<{ x: number; y: number; width: number; height: number }>,
  blockedRects: Array<{ x: number; y: number; width: number; height: number }>,
  gap = 0.6,
) {
  const candidate = { x, y, width, height }
  return existing.some((building) => rectsOverlap(candidate, building, gap)) || blockedRects.some((rect) => rectsOverlap(candidate, rect, gap))
}

function fallbackBuildingPoint(
  width: number,
  length: number,
  footprintW: number,
  footprintL: number,
  existing: Array<{ x: number; y: number; width: number; height: number }>,
  blockedRects: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const minX = 4
  const minY = 4
  const maxX = Math.max(minX, width - footprintW - 4)
  const maxY = Math.max(minY, length - footprintL - 4)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!buildingOverlaps(x, y, footprintW, footprintL, existing, blockedRects)) {
        return { x, y }
      }
    }
  }

  return { x: minX, y: minY }
}

// Bias where scattered turf blobs are centered, without constraining their shape.
function sampleTurfCenter(mode: 'centre' | 'sides' | 'full-site', width: number, length: number, rng: () => number) {
  if (mode === 'centre') {
    return {
      x: clamp(width / 2 + (rng() - 0.5) * width * 0.3, 2, width - 2),
      y: clamp(length / 2 + (rng() - 0.5) * length * 0.3, 2, length - 2),
    }
  }

  if (mode === 'sides') {
    const onLeft = rng() < 0.5
    return {
      x: clamp(onLeft ? rng() * width * 0.35 : width - rng() * width * 0.35, 2, width - 2),
      y: clamp(rng() * length, 2, length - 2),
    }
  }

  return { x: rng() * width, y: rng() * length }
}

// Scatters irregular turf blobs whose combined area approximates the coverage %, leaving bare ground exposed elsewhere.
function generateTurfPatches(
  mode: 'centre' | 'sides' | 'full-site',
  width: number,
  length: number,
  coverage: number,
  rng: () => number,
): TurfPatch[] {
  // Overlapping blobs can never truly reach full coverage by scattering alone — at (near) 100%
  // just cover the whole site outright, matching "approaching one giant patch near 100%".
  if (coverage >= 99.5) {
    return [{ id: 'turf-0', x: 0, y: 0, width, height: length, coverage: 100 }]
  }

  const totalArea = width * length
  const targetArea = totalArea * clamp(coverage / 100, 0, 1)
  const maxPatchSize = Math.max(3, Math.min(width, length) * 0.22)
  const minPatchSize = Math.max(2, maxPatchSize * 0.35)

  const patches: TurfPatch[] = []
  let coveredArea = 0
  let guard = 0

  while (coveredArea < targetArea && guard < 400) {
    guard += 1
    const center = sampleTurfCenter(mode, width, length, rng)
    const patchWidth = minPatchSize + rng() * (maxPatchSize - minPatchSize)
    const patchHeight = minPatchSize + rng() * (maxPatchSize - minPatchSize)
    const x = clamp(center.x - patchWidth / 2, 0, Math.max(0, width - patchWidth))
    const y = clamp(center.y - patchHeight / 2, 0, Math.max(0, length - patchHeight))
    const clampedWidth = Math.min(patchWidth, width - x)
    const clampedHeight = Math.min(patchHeight, length - y)
    if (clampedWidth <= 0 || clampedHeight <= 0) continue

    const area = clampedWidth * clampedHeight
    patches.push({
      id: `turf-${patches.length}`,
      x,
      y,
      width: clampedWidth,
      height: clampedHeight,
      coverage: (area / totalArea) * 100,
    })
    coveredArea += area
  }

  return patches
}

type RoadOrientation = 'h' | 'v'
type RoadSeed = { x: number; y: number; width: number; height: number; orientation: RoadOrientation }

// Spawns a branch road perpendicular to `parent`, starting from a point along the parent's span (an
// "intersection") and reaching toward one side of the site — like a side street fanning off a junction,
// rather than another full-span stripe parallel to everything else. `priorBranches` (branches already spawned
// from this same parent) spreads new branch points out along the parent instead of clumping near each other.
function branchRoadSeed(parent: RoadSeed, width: number, length: number, roadThickness: number, rng: () => number, priorBranches: number): RoadSeed {
  const half = roadThickness / 2
  const t = ((priorBranches + 1) * 0.6180339887 + rng() * 0.12) % 1

  if (parent.orientation === 'h') {
    const branchX = clamp(parent.x + half + t * Math.max(0, parent.width - roadThickness), half, width - half)
    const parentY = parent.y + half
    const towardTop = rng() < 0.5
    const reach = 0.3 + rng() * 0.4
    const span = towardTop ? parentY : length - parentY
    const height = Math.max(roadThickness, span * reach)
    const y = towardTop ? parentY - height : parentY
    return { x: clamp(branchX - half, 0, width - roadThickness), y: clamp(y, 0, length - roadThickness), width: roadThickness, height, orientation: 'v' }
  }

  const branchY = clamp(parent.y + half + t * Math.max(0, parent.height - roadThickness), half, length - half)
  const parentX = parent.x + half
  const towardLeft = rng() < 0.5
  const reach = 0.3 + rng() * 0.4
  const span = towardLeft ? parentX : width - parentX
  const roadWidth = Math.max(roadThickness, span * reach)
  const x = towardLeft ? parentX - roadWidth : parentX
  return { x: clamp(x, 0, width - roadThickness), y: clamp(branchY - half, 0, length - roadThickness), width: roadWidth, height: roadThickness, orientation: 'h' }
}

// Builds a small street network: the first two roads are full-span arterials crossing at right angles
// (one horizontal, one vertical), and any further roads branch outward from a random existing road —
// radiating from that intersection instead of stacking another parallel stripe.
function buildRoadNetwork(count: number, width: number, length: number, roadThickness: number, rng: () => number): RoadSeed[] {
  const seeds: RoadSeed[] = []
  const branchCounts = new Map<number, number>()

  for (let i = 0; i < count; i += 1) {
    if (i === 0) {
      const orientation: RoadOrientation = width >= length ? 'h' : 'v'
      seeds.push(
        orientation === 'h'
          ? { x: 0, y: clamp(length * 0.5 - roadThickness / 2, 0, length - roadThickness), width, height: roadThickness, orientation }
          : { x: clamp(width * 0.5 - roadThickness / 2, 0, width - roadThickness), y: 0, width: roadThickness, height: length, orientation },
      )
      continue
    }

    if (i === 1) {
      const orientation: RoadOrientation = seeds[0].orientation === 'h' ? 'v' : 'h'
      const t = 0.3 + rng() * 0.4
      seeds.push(
        orientation === 'h'
          ? { x: 0, y: clamp(length * t - roadThickness / 2, 0, length - roadThickness), width, height: roadThickness, orientation }
          : { x: clamp(width * t - roadThickness / 2, 0, width - roadThickness), y: 0, width: roadThickness, height: length, orientation },
      )
      continue
    }

    // Branch roads mostly fan out from the two main arterials (round-robin, so they spread across both axes
    // instead of snowballing off each other into one corner); occasionally a branch grows off a prior branch
    // for a deeper, more organic fan-out.
    const parentIndex = rng() < 0.3 && seeds.length > 2 ? Math.floor(rng() * seeds.length) : i % 2
    const parent = seeds[parentIndex]
    const priorBranches = branchCounts.get(parentIndex) ?? 0
    branchCounts.set(parentIndex, priorBranches + 1)
    seeds.push(branchRoadSeed(parent, width, length, roadThickness, rng, priorBranches))
  }

  return seeds
}

export function generateLandscape(config: Partial<LandscapeConfig> = {}): GeneratedLandscape {
  const merged: LandscapeConfig = { ...DEFAULT_CONFIG, ...config }
  // Each feature owns its own identity + placement RNG stream, so adjusting one feature's count/pattern
  // never shifts the random draws consumed by any other feature (buildings, roads, trees, shrubs, turf).
  const buildingIdentityRng = createRng(merged.seed ^ 0x85ebca6b)
  const treeIdentityRng = createRng(merged.seed ^ 0x27d4eb2f)
  const shrubIdentityRng = createRng(merged.seed ^ 0x165667b1)
  const turfIdentityRng = createRng(merged.seed ^ 0xd3a2646c)

  const buildingPlacementRng = createRng(merged.seed ^ 0x9e3779b9)
  const treePlacementRng = createRng(merged.seed ^ 0xc2b2ae35)
  const shrubPlacementRng = createRng(merged.seed ^ 0xfd7046c5)
  const turfPlacementRng = createRng(merged.seed ^ 0x1b873593)
  const roadPlacementRng = createRng(merged.seed ^ 0x8b6cd1d7)
  getZones(merged.width, merged.length)

  // Roads form a small street network: the first two cross at right angles, and any further roads branch
  // outward from an existing intersection instead of stacking another parallel horizontal stripe.
  const roadThickness = Math.max(1.5, Math.min(merged.width, merged.length) * 0.045)
  const roadSeeds = buildRoadNetwork(merged.roadCount, merged.width, merged.length, roadThickness, roadPlacementRng)
  const roads: BuildingItem[] = roadSeeds.map((seed, i) => ({
    id: `road-${i}`,
    x: seed.x,
    y: seed.y,
    width: seed.width,
    height: seed.height,
    elevation: 0.09,
  }))

  // Buildings are placed first so vegetation placement can reject/resample points inside their footprint.
  const buildings: BuildingItem[] = []
  if (merged.buildingCount > 0) {
    const footprintW = Math.max(6, merged.width * 0.1)
    const footprintL = Math.max(6, merged.length * 0.1)
    const buildingPattern = merged.buildingPattern ?? 'clustered'

    for (let i = 0; i < merged.buildingCount; i += 1) {
      let point = patternBuildings(
        buildingPattern,
        i,
        merged.buildingCount,
        merged.width,
        merged.length,
        footprintW,
        footprintL,
        buildingPlacementRng,
      )
      for (let attempt = 0; buildingOverlaps(point.x, point.y, footprintW, footprintL, buildings, roads) && attempt < 32; attempt += 1) {
        point = patternBuildings(
          buildingPattern,
          i + attempt + 1,
          merged.buildingCount,
          merged.width,
          merged.length,
          footprintW,
          footprintL,
          buildingPlacementRng,
        )
      }
      if (buildingOverlaps(point.x, point.y, footprintW, footprintL, buildings, roads)) {
        point = fallbackBuildingPoint(merged.width, merged.length, footprintW, footprintL, buildings, roads)
      }

      buildings.push({
        id: `building-${i}`,
        x: point.x,
        y: point.y,
        width: footprintW,
        height: footprintL,
        elevation: 5 + buildingIdentityRng() * 11,
      })
    }
  }

  const blockedRects = [...roads, ...buildings]
  const treeFootprints: Array<{ x: number; y: number; radius: number }> = []
  const shrubFootprints: Array<{ x: number; y: number; radius: number }> = []

  // Trees are always high vegetation by definition (spec floor is 3.50m, not 3.00m).
  const treeShapes = merged.scenario === 'temperate' ? TEMPERATE_TREE_SHAPES : TROPICAL_TREE_SHAPES
  const trees: TreeItem[] = []
  for (let i = 0; i < merged.treeCount; i += 1) {
    const pattern = merged.treePlacement ?? 'random'
    const height = 3.5 + treeIdentityRng() * (14 - 3.5)
    const crownShape = treeShapes[Math.floor(treeIdentityRng() * treeShapes.length)]
    const footprintRadius = treeFootprintRadius(height, crownShape)
    let point = patternPoint(pattern, i, merged.treeCount, merged.width, merged.length, treePlacementRng, roads, footprintRadius)
    for (let attempt = 0; isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, treeFootprints) && attempt < 25; attempt += 1) {
      point = patternPoint(pattern, i, merged.treeCount, merged.width, merged.length, treePlacementRng, roads, footprintRadius)
    }
    if (isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, treeFootprints)) {
      point = { ...point, ...findFreeCirclePoint(merged.width, merged.length, footprintRadius, blockedRects, treeFootprints, point) }
    }
    const size: TreeItem['size'] = height < 7 ? 'small' : height < 10.5 ? 'medium' : 'large'
    trees.push({
      id: `tree-${i}`,
      x: point.x,
      y: point.y,
      size,
      height,
      crownShape,
      zone: point.zone,
    })
    treeFootprints.push({ x: point.x, y: point.y, radius: footprintRadius })
  }

  // Shrub height spans bands 2-4 (0.11-3.49m) — a continuum, never one fixed band.
  // Temperate shrub tier stays conical-only (short pine); broadleaf maple/acer would need a
  // separate blocky-cluster canopy builder, which isn't implemented here.
  const shrubCrownShape: ShrubCrownShape = merged.scenario === 'temperate' ? 'pine' : 'round'
  const shrubs: ShrubItem[] = []
  for (let i = 0; i < merged.shrubCount; i += 1) {
    const pattern = merged.shrubPattern ?? 'random'
    const height = 0.11 + shrubIdentityRng() * (3.49 - 0.11)
    const footprintRadius = shrubFootprintRadius(height, shrubCrownShape)
    let point = patternShrubs(pattern, i, merged.shrubCount, merged.width, merged.length, shrubPlacementRng, roads, footprintRadius)
    for (let attempt = 0; isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints]) && attempt < 25; attempt += 1) {
      point = patternShrubs(pattern, i, merged.shrubCount, merged.width, merged.length, shrubPlacementRng, roads)
    }
    if (isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints])) {
      point = { ...point, ...findFreeCirclePoint(merged.width, merged.length, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints], point) }
    }
    shrubs.push({
      id: `shrub-${i}`,
      x: point.x,
      y: point.y,
      height,
      crownShape: shrubCrownShape,
      zone: point.zone,
    })
    shrubFootprints.push({ x: point.x, y: point.y, radius: footprintRadius })
  }

  const turfMode = merged.turfPlacement === 'custom' ? 'full-site' : merged.turfPlacement
  const turfPatches: TurfPatch[] = generateTurfPatches(turfMode, merged.width, merged.length, merged.turfCoverage, turfPlacementRng)

  const canopyVoxels: CanopyVoxel[] = []
  for (const tree of trees) canopyVoxels.push(...generateTreeCanopyVoxels(tree, treeIdentityRng))
  for (const shrub of shrubs) canopyVoxels.push(...generateShrubCanopyVoxels(shrub, shrubIdentityRng))
  const turfVoxels = generateTurfVoxels(turfPatches, buildings, roads, merged.width, merged.length, turfIdentityRng)

  return {
    trees,
    shrubs,
    turfPatches,
    buildings,
    roads,
    canopyVoxels,
    turfVoxels,
    overlaps: 0,
    spacingViolations: 0,
    usableArea: merged.width * merged.length,
  }
}
