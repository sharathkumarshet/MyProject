import type { PcFluxLevel } from '../../types/metrics'

export interface PcFluxClass {
  level: PcFluxLevel
  label: string
  minRelative: number
  color: string
  bgClass: string
  textClass: string
  ringClass: string
}

// Ordered 5 (most critical) -> 1 (marginal), thresholds per spec section 6.4.
export const PC_FLUX_CLASSES: PcFluxClass[] = [
  { level: 5, label: 'Critical (backbone)', minRelative: 0.8, color: '#dc2626', bgClass: 'bg-red-600/20', textClass: 'text-red-400', ringClass: 'ring-red-500' },
  { level: 4, label: 'High (major hub)', minRelative: 0.5, color: '#f97316', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400', ringClass: 'ring-orange-500' },
  { level: 3, label: 'Moderate (stepping-stone)', minRelative: 0.25, color: '#eab308', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400', ringClass: 'ring-yellow-500' },
  { level: 2, label: 'Low (minor)', minRelative: 0.1, color: '#0d9488', bgClass: 'bg-teal-600/20', textClass: 'text-teal-400', ringClass: 'ring-teal-500' },
  { level: 1, label: 'Marginal (isolated)', minRelative: 0, color: '#2563eb', bgClass: 'bg-blue-600/20', textClass: 'text-blue-400', ringClass: 'ring-blue-500' },
]

export function classifyRelativePcFlux(relative: number): PcFluxLevel {
  for (const cls of PC_FLUX_CLASSES) {
    if (relative >= cls.minRelative) return cls.level
  }
  return 1
}

export function getPcFluxClass(level: PcFluxLevel): PcFluxClass {
  return PC_FLUX_CLASSES.find((cls) => cls.level === level) ?? PC_FLUX_CLASSES[PC_FLUX_CLASSES.length - 1]
}

export function classifyPatchesByPcFlux<T extends { pcFlux: number }>(
  patches: T[],
): (T & { importanceRelative: number; importanceLevel: PcFluxLevel })[] {
  const maxFlux = Math.max(0, ...patches.map((patch) => patch.pcFlux))
  return patches.map((patch) => {
    const importanceRelative = maxFlux > 0 ? patch.pcFlux / maxFlux : 0
    return { ...patch, importanceRelative, importanceLevel: classifyRelativePcFlux(importanceRelative) }
  })
}

export function pcFluxClassDistribution(patches: { importanceLevel: PcFluxLevel }[]): Record<PcFluxLevel, number> {
  const distribution: Record<PcFluxLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const patch of patches) distribution[patch.importanceLevel] += 1
  return distribution
}
