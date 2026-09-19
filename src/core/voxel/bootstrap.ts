import { CANOPY_COUNTS } from '../../data/canopyCounts'
import { TURF_COUNTS } from '../../data/turfCounts'

// Sampling with replacement: every density value used anywhere in the scene genuinely occurred in the real pool.
export function sampleCanopyCount(rng: () => number): number {
  return CANOPY_COUNTS[Math.floor(rng() * CANOPY_COUNTS.length)]
}

export function sampleTurfCount(rng: () => number): number {
  return TURF_COUNTS[Math.floor(rng() * TURF_COUNTS.length)]
}
