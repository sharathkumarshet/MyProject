export type PcFluxLevel = 1 | 2 | 3 | 4 | 5

export interface StructuralBandMetrics {
  volume: number
  activeCells: number
  rh95Mean: number
  rh95Max: number
  nlMean: number
  vpdMean: number
}

export interface StructuralMetrics {
  low: StructuralBandMetrics
  high: StructuralBandMetrics
}

export interface TurfMetrics {
  coverageM2: number
  turfVolumeM3: number
  patchCount: number
  largestPatchM2: number
}

export interface ConnectivityPatchRef {
  type: 'turf' | 'shrub' | 'tree'
  index: number
}

export interface ConnectivityPatch {
  id: number
  area: number
  cx: number
  cy: number
  pcFlux: number
  dPC: number | null
  importanceRelative: number
  importanceLevel: PcFluxLevel
  members: ConnectivityPatchRef[]
}

export interface ConnectivityMetrics {
  wholeScenePc: number
  turfPc: number
  shrubPc: number
  treePc: number
  patches: ConnectivityPatch[]
}
