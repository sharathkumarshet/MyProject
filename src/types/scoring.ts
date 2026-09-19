import type { TreeSize, ZoneName } from './landscape'

export type ScoreCategory = 'trees' | 'shrubs' | 'turf' | 'bonus' | 'penalties'

export interface ScoringRules {
  treePoints: Record<TreeSize, number>
  locationMultipliers: Record<ZoneName, number>
  shrubPointsPerUnit: number
  shrubDensityMultipliers: Record<'low' | 'medium' | 'high', number>
  turfPointsPerPercent: number
  bonusCentre: number
  overcrowdingPenalty: number
  overlapPenalty: number
  insufficientSpacingPenalty: number
  maxDensityPerSqm: number
  minTreeSpacing: number
}

export interface ScoreLine {
  label: string
  points: number
  description: string
}

export interface ScoreBreakdown {
  total: number
  percentage: number
  maxScore: number
  categories: Record<ScoreCategory, number>
  lines: ScoreLine[]
}
