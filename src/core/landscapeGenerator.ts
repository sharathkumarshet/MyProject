import type { BuildingItem, GeneratedLandscape, LandscapeConfig, ShrubItem, TreeItem, TurfPatch } from '../types/landscape'
import type { CanopyVoxel, TreeCrownShape } from '../types/voxel'
import { DEFAULT_CONFIG } from '../config/defaults'
import { createRng } from './rng'
import { getZones } from './zones'
import { generateTreeCanopyVoxels } from './voxel/treeVoxels'
import { generateShrubCanopyVoxels } from './voxel/shrubVoxels'
import { generateTurfVoxels } from './voxel/turfVoxels'

const CROWN_SHAPES: TreeCrownShape[] = ['mango', 'rain-tree', 'palm']

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
) {
  const minX = radius + 0.2
  const minY = radius + 0.2
  const maxX = width - radius - 0.2
  const maxY = length - radius - 0.2

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isCircleBlocked(x, y, radius, blockedRects, blockedCircles)) {
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
  const crownBase = crownShape === 'palm' ? height * 0.92 : crownShape === 'rain-tree' ? height * 0.6 : height * 0.45
  const crownHeight = Math.max(0.5, height - crownBase)
  if (crownShape === 'rain-tree') return Math.min(3.2, Math.max(1.2, crownHeight * 1.3))
  if (crownShape === 'palm') return Math.min(2.4, Math.max(1.4, crownHeight * 1.05))
  return Math.min(2.6, Math.max(0.8, crownHeight * 0.55))
}

function shrubFootprintRadius(height: number) {
  return Math.min(1.6, Math.max(0.4, height * 0.5))
}

function patternPoint(
  pattern: 'random' | 'centre' | 'sides' | 'perimeter',
  index: number,
  count: number,
  width: number,
  length: number,
  rng: () => number,
) {
  const cx = width / 2
  const cy = length / 2

  if (pattern === 'centre') {
    const clusterRadiusX = width * 0.18
    const clusterRadiusY = length * 0.18
    const angle = (Math.PI * 2 * index) / Math.max(1, count)
    const radius = 0.25 + rng() * 0.75
    return {
      x: clamp(cx + Math.cos(angle) * clusterRadiusX * radius + (rng() - 0.5) * 4, 4, width - 4),
      y: clamp(cy + Math.sin(angle) * clusterRadiusY * radius + (rng() - 0.5) * 4, 4, length - 4),
      zone: 'centre' as const,
    }
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

  if (pattern === 'perimeter') {
    const side = (index % 4) as 0 | 1 | 2 | 3
    const inset = 5
    const edgeX = rng() * (width - inset * 2) + inset
    const edgeY = rng() * (length - inset * 2) + inset

    if (side === 0) {
      return { x: edgeX, y: inset + rng() * 2, zone: 'perimeter' as const }
    }
    if (side === 1) {
      return { x: width - inset - rng() * 2, y: edgeY, zone: 'perimeter' as const }
    }
    if (side === 2) {
      return { x: edgeX, y: length - inset - rng() * 2, zone: 'perimeter' as const }
    }
    return { x: inset + rng() * 2, y: edgeY, zone: 'perimeter' as const }
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
): { x: number; y: number; zone: 'centre' | 'left' | 'right' | 'front' | 'back' | 'perimeter' | 'other' } {
  if (pattern === 'clustered') {
    const clusters = [
      [width * 0.35, length * 0.35],
      [width * 0.65, length * 0.42],
      [width * 0.5, length * 0.7],
    ]
    const cluster = clusters[index % clusters.length]
    const offsetX = (rng() - 0.5) * 6
    const offsetY = (rng() - 0.5) * 6

    return {
      x: clamp(cluster[0] + offsetX, 2, width - 2),
      y: clamp(cluster[1] + offsetY, 2, length - 2),
      zone: 'centre' as const,
    }
  }

  if (pattern === 'linear') {
    const rows = Math.max(1, Math.round(Math.sqrt(count || 1)))
    const row = Math.floor(index / rows)
    const column = index % rows
    const padding = 6
    const x = padding + ((width - padding * 2) / Math.max(1, rows - 1)) * column + (rng() - 0.5) * 3
    const y = padding + ((length - padding * 2) / Math.max(1, rows - 1)) * row + (rng() - 0.5) * 3

    return {
      x: clamp(x, 2, width - 2),
      y: clamp(y, 2, length - 2),
      zone: row % 2 === 0 ? 'left' : 'right',
    }
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

export function generateLandscape(config: Partial<LandscapeConfig> = {}): GeneratedLandscape {
  const merged: LandscapeConfig = { ...DEFAULT_CONFIG, ...config }
  // Two independent streams: identity (height/crown/bootstrap density) is arrangement-invariant,
  // placement (positions) is the only thing arrangement changes — keeps structural metrics stable
  // across different layouts of the same quantity (spec 7.6).
  const identityRng = createRng(merged.seed)
  const buildingIdentityRng = createRng(merged.seed ^ 0x85ebca6b)
  const placementRng = createRng(merged.seed ^ 0x9e3779b9)
  getZones(merged.width, merged.length)

  // Roads are parallel strips so they never overlap one another, and all other features avoid them.
  const roads: BuildingItem[] = []
  const roadThickness = Math.max(1.5, Math.min(merged.width, merged.length) * 0.045)
  const horizontalRoads = merged.width >= merged.length || merged.roadCount === 1

  for (let i = 0; i < merged.roadCount; i += 1) {
    const slot = i + 1
    if (horizontalRoads) {
      const y = clamp((merged.length / (merged.roadCount + 1)) * slot - roadThickness / 2, 0, merged.length - roadThickness)
      roads.push({ id: `road-${i}`, x: 0, y, width: merged.width, height: roadThickness, elevation: 0.09 })
    } else {
      const x = clamp((merged.width / (merged.roadCount + 1)) * slot - roadThickness / 2, 0, merged.width - roadThickness)
      roads.push({ id: `road-${i}`, x, y: 0, width: roadThickness, height: merged.length, elevation: 0.09 })
    }
  }

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
        placementRng,
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
          placementRng,
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
  const trees: TreeItem[] = []
  for (let i = 0; i < merged.treeCount; i += 1) {
    const pattern = merged.treePlacement ?? 'random'
    const height = 3.5 + identityRng() * (14 - 3.5)
    const crownShape = CROWN_SHAPES[Math.floor(identityRng() * CROWN_SHAPES.length)]
    const footprintRadius = treeFootprintRadius(height, crownShape)
    let point = patternPoint(pattern, i, merged.treeCount, merged.width, merged.length, placementRng)
    for (let attempt = 0; isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, treeFootprints) && attempt < 25; attempt += 1) {
      point = patternPoint(pattern, i, merged.treeCount, merged.width, merged.length, placementRng)
    }
    if (isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, treeFootprints)) {
      point = { ...point, ...findFreeCirclePoint(merged.width, merged.length, footprintRadius, blockedRects, treeFootprints) }
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
  const shrubs: ShrubItem[] = []
  for (let i = 0; i < merged.shrubCount; i += 1) {
    const pattern = merged.shrubPattern ?? 'random'
    const height = 0.11 + identityRng() * (3.49 - 0.11)
    const footprintRadius = shrubFootprintRadius(height)
    let point = patternShrubs(pattern, i, merged.shrubCount, merged.width, merged.length, placementRng)
    for (let attempt = 0; isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints]) && attempt < 25; attempt += 1) {
      point = patternShrubs(pattern, i, merged.shrubCount, merged.width, merged.length, placementRng)
    }
    if (isCircleBlocked(point.x, point.y, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints])) {
      point = { ...point, ...findFreeCirclePoint(merged.width, merged.length, footprintRadius, blockedRects, [...treeFootprints, ...shrubFootprints]) }
    }
    shrubs.push({
      id: `shrub-${i}`,
      x: point.x,
      y: point.y,
      height,
      zone: point.zone,
    })
    shrubFootprints.push({ x: point.x, y: point.y, radius: footprintRadius })
  }

  const turfMode = merged.turfPlacement === 'custom' ? 'full-site' : merged.turfPlacement
  const turfPatches: TurfPatch[] = generateTurfPatches(turfMode, merged.width, merged.length, merged.turfCoverage, placementRng)

  const canopyVoxels: CanopyVoxel[] = []
  for (const tree of trees) canopyVoxels.push(...generateTreeCanopyVoxels(tree, identityRng))
  for (const shrub of shrubs) canopyVoxels.push(...generateShrubCanopyVoxels(shrub, identityRng))
  const turfVoxels = generateTurfVoxels(turfPatches, buildings, roads, merged.width, merged.length, identityRng)

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
