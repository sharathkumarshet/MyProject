import type { BuildingItem, Vector2, ZoneName } from '../types/landscape'

export interface ZoneRect {
  name: ZoneName
  x: number
  y: number
  width: number
  height: number
}

export function getZones(width: number, length: number): Record<ZoneName, ZoneRect> {
  const centreWidth = width * 0.46
  const centreLength = length * 0.5
  const perimeterOffset = Math.min(width, length) * 0.12

  const centre: ZoneRect = {
    name: 'centre',
    x: (width - centreWidth) / 2,
    y: (length - centreLength) / 2,
    width: centreWidth,
    height: centreLength,
  }

  const left: ZoneRect = {
    name: 'left',
    x: 0,
    y: 0,
    width: width * 0.28,
    height: length,
  }

  const right: ZoneRect = {
    name: 'right',
    x: width * 0.72,
    y: 0,
    width: width * 0.28,
    height: length,
  }

  const front: ZoneRect = {
    name: 'front',
    x: 0,
    y: 0,
    width: width,
    height: length * 0.28,
  }

  const back: ZoneRect = {
    name: 'back',
    x: 0,
    y: length * 0.72,
    width: width,
    height: length * 0.28,
  }

  const perimeterRect: ZoneRect = {
    name: 'perimeter',
    x: perimeterOffset,
    y: perimeterOffset,
    width: width - perimeterOffset * 2,
    height: length - perimeterOffset * 2,
  }

  return {
    centre,
    left,
    right,
    front,
    back,
    perimeter: perimeterRect,
    other: { name: 'other', x: 0, y: 0, width, height: length },
  }
}

export function pointInRect(point: Vector2, rect: ZoneRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

export function getBuildingFootprints(width: number, length: number, count: number): BuildingItem[] {
  const buildings: BuildingItem[] = []
  const step = Math.max(1, Math.floor(Math.sqrt(count || 1)))

  for (let i = 0; i < count; i += 1) {
    const col = i % step
    const row = Math.floor(i / step)
    const areaW = Math.max(6, width * 0.18)
    const areaL = Math.max(6, length * 0.18)
    const x = 10 + col * (width / Math.max(step, 1))
    const y = 10 + row * (length / Math.max(step, 1))
    buildings.push({
      id: `building-${i}`,
      x: Math.min(x, width - areaW),
      y: Math.min(y, length - areaL),
      width: areaW,
      height: areaL,
      elevation: 8,
    })
  }

  return buildings
}
