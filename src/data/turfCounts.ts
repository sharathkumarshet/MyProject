// Synthetic stand-in for real turf LiDAR Count values (Tengah site): range 1-42, median 9, mean 9.4.
function expand(weights: Array<[value: number, count: number]>): number[] {
  const values: number[] = []
  for (const [value, count] of weights) {
    for (let i = 0; i < count; i += 1) values.push(value)
  }
  return values
}

export const TURF_COUNTS: number[] = expand([
  [1, 6], [2, 8], [4, 10], [6, 10], [8, 10], [9, 12], [10, 10], [12, 8], [14, 6], [18, 6], [24, 3], [30, 2], [42, 1],
])
