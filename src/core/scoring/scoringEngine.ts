import { DEFAULT_SCORING_RULES } from '../../config/scoringRules'
import type { GeneratedLandscape, LandscapeConfig } from '../../types/landscape'
import type { ScoreBreakdown } from '../../types/scoring'

export function scoreLandscape(
  config: LandscapeConfig,
  generated: GeneratedLandscape,
  rules = DEFAULT_SCORING_RULES,
): ScoreBreakdown {
  const treeScore = generated.trees.reduce((sum, tree) => {
    const multiplier = rules.locationMultipliers[tree.zone] ?? rules.locationMultipliers.other
    return sum + rules.treePoints[tree.size] * multiplier
  }, 0)

  const shrubDensity = rules.shrubDensityMultipliers[config.shrubDensity]
  const shrubScore = generated.shrubs.length * rules.shrubPointsPerUnit * shrubDensity

  const turfScore = config.turfCoverage * rules.turfPointsPerPercent

  const bonus = generated.trees.filter((tree) => tree.zone === 'centre').length * rules.bonusCentre

  const penalties =
    generated.overlaps * rules.overlapPenalty +
    generated.spacingViolations * rules.insufficientSpacingPenalty +
    Math.max(0, generated.shrubs.length / Math.max(1, config.width * config.length) - rules.maxDensityPerSqm) * 100

  const total = Math.max(0, treeScore + shrubScore + turfScore + bonus - penalties)
  const maxScore = Math.max(1, treeScore + shrubScore + turfScore + bonus + 100)
  const percentage = Math.round((total / maxScore) * 100)

  return {
    total,
    percentage,
    maxScore,
    categories: {
      trees: treeScore,
      shrubs: shrubScore,
      turf: turfScore,
      bonus,
      penalties: -penalties,
    },
    lines: [
      { label: 'Trees', points: Math.round(treeScore), description: `${generated.trees.length} trees scored by size and placement.` },
      { label: 'Shrubs', points: Math.round(shrubScore), description: `${generated.shrubs.length} shrubs at ${config.shrubDensity} density.` },
      { label: 'Turf', points: Math.round(turfScore), description: `${config.turfCoverage}% turf coverage.` },
      { label: 'Bonus', points: Math.round(bonus), description: 'Centre placement bonus.' },
      { label: 'Penalties', points: -Math.round(penalties), description: 'Overlap and spacing reductions.' },
    ],
  }
}
