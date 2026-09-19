// Shared raster grid helpers: 1m x 1m cells, 4-connected (edge-only, no diagonals) patch labeling.
export interface RasterPatch {
  id: number
  cells: number
  cx: number
  cy: number
  cellIndices: number[]
}

export interface RasterLabelResult {
  patches: RasterPatch[]
  labels: Int32Array
  cols: number
  rows: number
}

export function buildMask(points: Array<{ x: number; y: number }>, cols: number, rows: number): Uint8Array {
  const mask = new Uint8Array(cols * rows)
  for (const point of points) {
    const x = Math.round(point.x)
    const y = Math.round(point.y)
    if (x < 0 || x >= cols || y < 0 || y >= rows) continue
    mask[y * cols + x] = 1
  }
  return mask
}

export function unionMasks(masks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size)
  for (const mask of masks) {
    for (let i = 0; i < size; i += 1) {
      if (mask[i]) result[i] = 1
    }
  }
  return result
}

// Flood fill on a footprint mask — patch area is real occupied cell count (m^2), never inflated by overlap.
export function labelPatches(mask: Uint8Array, cols: number, rows: number): RasterLabelResult {
  const labels = new Int32Array(cols * rows).fill(-1)
  const patches: RasterPatch[] = []
  const stack: number[] = []

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || labels[start] !== -1) continue

    const id = patches.length
    let count = 0
    let sumX = 0
    let sumY = 0
    const cellIndices: number[] = []

    stack.push(start)
    labels[start] = id

    while (stack.length > 0) {
      const index = stack.pop() as number
      const x = index % cols
      const y = Math.floor(index / cols)
      count += 1
      sumX += x
      sumY += y
      cellIndices.push(index)

      const neighbors = [x > 0 ? index - 1 : -1, x < cols - 1 ? index + 1 : -1, y > 0 ? index - cols : -1, y < rows - 1 ? index + cols : -1]
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] === 1 && labels[neighbor] === -1) {
          labels[neighbor] = id
          stack.push(neighbor)
        }
      }
    }

    patches.push({ id, cells: count, cx: sumX / count + 0.5, cy: sumY / count + 0.5, cellIndices })
  }

  return { patches, labels, cols, rows }
}
