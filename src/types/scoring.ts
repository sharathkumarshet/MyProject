export type ScoreCategory = 'connectivity' | 'fragmentation' | 'largestPatch'

export interface ScoringRules {
  connectivityWeight: number
  fragmentationWeight: number
  largestPatchWeight: number
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
