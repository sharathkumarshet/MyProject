// Synthetic stand-ins for real LiDAR Count values (no live CSVs available at build time).
// Each table is hand-tuned so its median/mean/range land close to the real site stats in the spec:
//   Tengah canopy:    range 2-42, median 4, mean 5.4
//   Woodleigh canopy: range 2-42, median 6, mean 7.9
//   Simei canopy:     range 2-25, median 4, mean 5.1
function expand(weights: Array<[value: number, count: number]>): number[] {
  const values: number[] = []
  for (const [value, count] of weights) {
    for (let i = 0; i < count; i += 1) values.push(value)
  }
  return values
}

const tengah = expand([
  [2, 12], [3, 22], [4, 26], [5, 14], [6, 9], [7, 5], [8, 4], [10, 3], [14, 2], [20, 2], [30, 1], [42, 1],
])

const woodleigh = expand([
  [2, 6], [3, 10], [4, 14], [5, 14], [6, 14], [7, 10], [8, 8], [10, 6], [12, 4], [16, 4], [20, 4], [28, 3], [42, 2],
])

const simei = expand([
  [2, 14], [3, 22], [4, 24], [5, 14], [6, 8], [7, 5], [8, 4], [10, 3], [14, 2], [20, 2], [25, 1],
])

// Pooling all three real sites gives a broader, more representative canopy Count pool.
export const CANOPY_COUNTS: number[] = [...tengah, ...woodleigh, ...simei]
