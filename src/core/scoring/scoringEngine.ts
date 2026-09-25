import { DEFAULT_SCORING_RULES } from '../../config/scoringRules'
import type { ConnectivityMetrics, FragmentationMetrics } from '../../types/metrics'
import type { ScoreBreakdown } from '../../types/scoring'

// Score is a weighted average of already-normalised fragmentation outcomes (0-100 scale each),
// never raw counts (tree count) or category labels (arrangement/scenario), so it reflects the
// same fragmentation outcome the rest of the tool measures.
export function scoreLandscape(
  connectivity: ConnectivityMetrics,
  fragmentation: FragmentationMetrics,
  rules = DEFAULT_SCORING_RULES,
): ScoreBreakdown {
  const connectivityScore = connectivity.wholeScenePc * 100
  const fragmentationScore = fragmentation.overall.fragmentationIndex * 100
  const largestPatchScore = fragmentation.overall.largestPatchIndex

  const weightSum = rules.connectivityWeight + rules.fragmentationWeight + rules.largestPatchWeight
  const total =
    (connectivityScore * rules.connectivityWeight +
      fragmentationScore * rules.fragmentationWeight +
      largestPatchScore * rules.largestPatchWeight) /
    Math.max(1e-9, weightSum)
  const maxScore = 100
  const percentage = Math.round((total / maxScore) * 100)

  return {
    total,
    percentage,
    maxScore,
    categories: {
      connectivity: connectivityScore,
      fragmentation: fragmentationScore,
      largestPatch: largestPatchScore,
    },
    lines: [
      { label: 'Connectivity', points: Math.round(connectivityScore), description: 'Whole-scene probability of connectivity (PC), on a 0-100 scale.' },
      { label: 'Fragmentation', points: Math.round(fragmentationScore), description: 'Overall fragmentation index (FFI), on a 0-100 scale.' },
      { label: 'Largest patch', points: Math.round(largestPatchScore), description: 'Overall largest patch index (LPI %) of the scene.' },
    ],
  }
}
