import type { CanopyVoxel, TreeCrownShape, TurfVoxel } from './voxel'

export type ZoneName = 'centre' | 'left' | 'right' | 'front' | 'back' | 'perimeter' | 'other'

export type TreeSize = 'small' | 'medium' | 'large'
export type TreePlacement = 'centre' | 'sides' | 'perimeter' | 'random'
export type ShrubPattern = 'clustered' | 'linear' | 'random' | 'border'
export type BuildingPattern = 'clustered' | 'linear' | 'random'
export type TurfPlacement = 'centre' | 'sides' | 'full-site' | 'custom'

export interface SiteConfig {
  width: number
  length: number
  seed: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface TreeItem {
  id: string
  x: number
  y: number
  size: TreeSize
  height: number
  crownShape: TreeCrownShape
  zone: ZoneName
}

export interface ShrubItem {
  id: string
  x: number
  y: number
  height: number
  zone: ZoneName
}

export interface TurfPatch {
  id: string
  x: number
  y: number
  width: number
  height: number
  coverage: number
}

export interface BuildingItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  elevation: number
}

export interface LandscapeConfig extends SiteConfig {
  treeCount: number
  shrubCount: number
  turfCoverage: number
  buildingCount: number
  buildingPattern: BuildingPattern
  treePlacement: TreePlacement
  shrubPattern: ShrubPattern
  turfPlacement: TurfPlacement
  shrubDensity: 'low' | 'medium' | 'high'
  treeDistribution: 'clustered' | 'even' | 'random' | 'grid'
  roadCount: number
}

export interface GeneratedLandscape {
  trees: TreeItem[]
  shrubs: ShrubItem[]
  turfPatches: TurfPatch[]
  buildings: BuildingItem[]
  roads: BuildingItem[]
  canopyVoxels: CanopyVoxel[]
  turfVoxels: TurfVoxel[]
  overlaps: number
  spacingViolations: number
  usableArea: number
}
