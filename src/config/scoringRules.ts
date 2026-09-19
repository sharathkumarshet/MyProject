import type { ScoringRules } from '../types/scoring'

export const DEFAULT_SCORING_RULES: ScoringRules = {
  treePoints: {
    small: 2,
    medium: 4,
    large: 7,
  },
  locationMultipliers: {
    centre: 1.6,
    left: 1.1,
    right: 1.1,
    front: 1.1,
    back: 1.1,
    perimeter: 1.2,
    other: 1,
  },
  shrubPointsPerUnit: 0.1,
  shrubDensityMultipliers: {
    low: 0.8,
    medium: 1,
    high: 1.4,
  },
  turfPointsPerPercent: 0.2,
  bonusCentre: 10,
  overcrowdingPenalty: 0.8,
  overlapPenalty: 2,
  insufficientSpacingPenalty: 2,
  maxDensityPerSqm: 0.06,
  minTreeSpacing: 4,
}
