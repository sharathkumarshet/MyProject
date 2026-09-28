import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../src/config/defaults'
import { generateLandscape } from '../src/core/landscapeGenerator'
import { computeStructuralMetrics } from '../src/core/metrics/structuralMetrics'
import { computeConnectivity } from '../src/core/metrics/connectivity'
import { computeFragmentation } from '../src/core/metrics/fragmentationMetrics'
import { scoreLandscape } from '../src/core/scoring/scoringEngine'
import type { LandscapeConfig } from '../src/types/landscape'

const SITE = { width: 120, length: 120, seed: 42 }

type ScenarioDef = { id: string; overrides: Partial<LandscapeConfig> }

const scenarios: ScenarioDef[] = [
  // Block A - infrastructure density, vegetation held constant
  { id: 'A1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 24, shrubPattern: 'random', treeCount: 18, treePlacement: 'random' } },
  { id: 'A2', overrides: { roadCount: 5, buildingCount: 6, turfCoverage: 55, shrubCount: 24, shrubPattern: 'random', treeCount: 18, treePlacement: 'random' } },

  // Block B - shrubs only, trees 0
  { id: 'B1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 30, shrubPattern: 'random' } },
  { id: 'B2', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 50, shrubPattern: 'random' } },
  { id: 'B3', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 100, shrubPattern: 'random' } },
  { id: 'B4', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 200, shrubPattern: 'random' } },
  { id: 'B5', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 100, shrubPattern: 'clustered' } },
  { id: 'B6', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, treeCount: 0, shrubCount: 100, shrubPattern: 'linear' } },

  // Block C - turf only, shrubs 0, trees 60 scattered
  { id: 'C1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 0, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },
  { id: 'C2', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 20, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },
  { id: 'C3', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 40, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },
  { id: 'C4', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 60, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },
  { id: 'C5', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 80, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },
  { id: 'C6', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 100, shrubCount: 0, treeCount: 60, treePlacement: 'random' } },

  // Block D - turf and shrubs combined, trees 0
  { id: 'D1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 20, shrubCount: 50, shrubPattern: 'random', treeCount: 0 } },
  { id: 'D2', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 20, shrubCount: 50, shrubPattern: 'clustered', treeCount: 0 } },
  { id: 'D3', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 80, shrubCount: 200, shrubPattern: 'random', treeCount: 0 } },
  { id: 'D4', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 80, shrubCount: 200, shrubPattern: 'clustered', treeCount: 0 } },

  // Block E - trees only, shrubs 0, turf 55%
  { id: 'E1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 30, treePlacement: 'random' } },
  { id: 'E2', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 80, treePlacement: 'random' } },
  { id: 'E3', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 150, treePlacement: 'random' } },
  { id: 'E4', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 250, treePlacement: 'random' } },
  { id: 'E5', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 150, treePlacement: 'centre' } },
  { id: 'E6', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 55, shrubCount: 0, treeCount: 150, treePlacement: 'perimeter' } },

  // Block F - trees against sparse vs dense ground layers
  { id: 'F1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 20, shrubCount: 50, shrubPattern: 'random', treeCount: 80, treePlacement: 'random' } },
  { id: 'F2', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 80, shrubCount: 200, shrubPattern: 'random', treeCount: 80, treePlacement: 'random' } },
  { id: 'F3', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 20, shrubCount: 50, shrubPattern: 'random', treeCount: 250, treePlacement: 'random' } },
  { id: 'F4', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 80, shrubCount: 200, shrubPattern: 'random', treeCount: 250, treePlacement: 'random' } },

  // Block G - control bookends
  { id: 'G1', overrides: { roadCount: 3, buildingCount: 4, turfCoverage: 0, shrubCount: 0, treeCount: 0 } },
  { id: 'G2', overrides: { roadCount: 5, buildingCount: 6, turfCoverage: 100, shrubCount: 200, shrubPattern: 'random', treeCount: 250, treePlacement: 'random' } },
]

type Row = Record<string, string | number>

function computeRow(scenarioId: string, biome: 'tropical' | 'temperate', overrides: Partial<LandscapeConfig>): Row {
  const config: LandscapeConfig = {
    ...DEFAULT_CONFIG,
    ...SITE,
    ...overrides,
    scenario: biome,
  }
  const generated = generateLandscape(config)
  const structural = computeStructuralMetrics(generated, config.width, config.length)
  const connectivity = computeConnectivity(generated, config.width, config.length)
  const fragmentation = computeFragmentation(generated, config.width, config.length)
  const score = scoreLandscape(connectivity, fragmentation)

  const frag = (layer: 'turf' | 'shrub' | 'tree' | 'overall') => {
    const m = fragmentation[layer]
    return {
      [`${layer}_patchCount`]: m.patchCount,
      [`${layer}_patchDensity`]: m.patchDensity,
      [`${layer}_edgeDensity`]: m.edgeDensity,
      [`${layer}_lpi`]: m.largestPatchIndex,
      [`${layer}_meanPatchAreaM2`]: m.meanPatchAreaM2,
      [`${layer}_ffi`]: m.fragmentationIndex,
    }
  }

  return {
    ScenarioID: scenarioId,
    Biome: biome === 'tropical' ? 'Tropical' : 'Temperate',
    RoadCount: config.roadCount,
    BuildingCount: config.buildingCount,
    TurfCoveragePct: config.turfCoverage,
    ShrubCount: config.shrubCount,
    ShrubPattern: config.shrubPattern,
    TreeCount: config.treeCount,
    TreePlacement: config.treePlacement,
    low_volume: structural.low.volume,
    low_activeCells: structural.low.activeCells,
    low_rh95Mean: structural.low.rh95Mean,
    low_rh95Max: structural.low.rh95Max,
    low_nlMean: structural.low.nlMean,
    low_vpdMean: structural.low.vpdMean,
    high_volume: structural.high.volume,
    high_activeCells: structural.high.activeCells,
    high_rh95Mean: structural.high.rh95Mean,
    high_rh95Max: structural.high.rh95Max,
    high_nlMean: structural.high.nlMean,
    high_vpdMean: structural.high.vpdMean,
    ...frag('turf'),
    ...frag('shrub'),
    ...frag('tree'),
    ...frag('overall'),
    wholeScenePc: connectivity.wholeScenePc,
    Score: score.percentage,
  }
}

const rows: Row[] = []
for (const scenario of scenarios) {
  rows.push(computeRow(scenario.id, 'tropical', scenario.overrides))
  rows.push(computeRow(scenario.id, 'temperate', scenario.overrides))
}

const headers = Object.keys(rows[0])
const csvLines = [headers.join(',')]
for (const row of rows) {
  csvLines.push(headers.map((h) => String(row[h])).join(','))
}

const outPath = path.join(process.cwd(), 'scenario-batch-60.csv')
fs.writeFileSync(outPath, csvLines.join('\n') + '\n', 'utf8')

console.log(`Wrote ${rows.length} rows to ${outPath}`)
