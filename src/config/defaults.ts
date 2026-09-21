import type { LandscapeConfig } from '../types/landscape'

export const DEFAULT_CONFIG: LandscapeConfig = {
  width: 60,
  length: 40,
  seed: 42,
  scenario: 'tropical',
  treeCount: 18,
  shrubCount: 24,
  turfCoverage: 55,
  buildingCount: 4,
  buildingPattern: 'clustered',
  treePlacement: 'centre',
  shrubPattern: 'clustered',
  turfPlacement: 'full-site',
  shrubDensity: 'medium',
  treeDistribution: 'clustered',
  roadCount: 2,
}

export const LIMITS = {
  width: { min: 20, max: 120 },
  length: { min: 20, max: 120 },
  seed: { min: 1, max: 999999 },
  treeCount: { min: 0, max: 750 },
  shrubCount: { min: 0, max: 1000 },
  turfCoverage: { min: 0, max: 100 },
  buildingCount: { min: 4, max: 14 },
  roadCount: { min: 2, max: 6 },
}
