import type { ScoringRules } from '../types/scoring'

export const DEFAULT_SCORING_RULES: ScoringRules = {
  connectivityWeight: 1 / 3,
  fragmentationWeight: 1 / 3,
  largestPatchWeight: 1 / 3,
}
