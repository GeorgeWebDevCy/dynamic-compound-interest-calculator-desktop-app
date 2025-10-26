const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { app } = require('electron')

const DEFAULT_SCENARIOS = require('../src/shared/default-settings.json')

const SCENARIO_COLORS = [
  '#10b981',
  '#6366f1',
  '#f97316',
  '#f43f5e',
  '#14b8a6',
  '#8b5cf6',
  '#facc15',
  '#0ea5e9',
]

const FALLBACK_SCENARIO =
  (Array.isArray(DEFAULT_SCENARIOS) && DEFAULT_SCENARIOS[0]) || {
    id: 'baseline',
    name: 'Baseline',
    color: '#10b981',
    settings: {
      principal: 0,
      contribution: 0,
      contributionFrequency: 12,
      annualReturn: 0,
      compoundingFrequency: 12,
      years: 1,
      fundExpenseRatio: 0,
      platformFee: 0,
      targetBalance: 0,
      vuaaShareCount: 0,
      vuaaPurchasePrice: 0,
      vuaaPurchaseDate: '',
    },
  }

const DEFAULT_CONFIG = {
  scenarios: Array.isArray(DEFAULT_SCENARIOS)
    ? DEFAULT_SCENARIOS.map((scenario) => cloneScenario(scenario))
    : [cloneScenario(FALLBACK_SCENARIO)],
}

const getConfigPath = () =>
  path.join(app.getPath('userData'), 'dynamic-compound-config.json')

function cloneScenario(scenario) {
  return {
    id: String(scenario.id ?? `scenario-${Date.now()}`),
    name: String(scenario.name ?? FALLBACK_SCENARIO.name),
    color: String(scenario.color ?? FALLBACK_SCENARIO.color),
    settings: {
      ...FALLBACK_SCENARIO.settings,
      ...(scenario.settings ?? scenario),
    },
  }
}

function cloneConfig(config) {
  return {
    scenarios: Array.isArray(config.scenarios)
      ? config.scenarios.map((scenario) => cloneScenario(scenario))
      : DEFAULT_CONFIG.scenarios.map((scenario) => cloneScenario(scenario)),
  }
}

function createId() {
  if (typeof randomUUID === 'function') {
    return randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isCompoundSettings(value) {
  if (!value || typeof value !== 'object') {
    return false
  }

  const requiredKeys = [
    'principal',
    'contribution',
    'contributionFrequency',
    'annualReturn',
    'compoundingFrequency',
    'years',
    'fundExpenseRatio',
    'platformFee',
    'vuaaShareCount',
    'vuaaPurchasePrice',
    'vuaaPurchaseDate',
  ]

  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function getNextColor(usedColors) {
  for (const color of SCENARIO_COLORS) {
    if (!usedColors.has(color)) {
      usedColors.add(color)
      return color
    }
  }

  const hue = Math.round(((usedColors.size + 1) * 137.508) % 360)
  const generated = `hsl(${hue} 70% 50%)`
  usedColors.add(generated)
  return generated
}

function normalizeScenario(candidate, index, usedColors) {
  const base = typeof candidate === 'object' && candidate !== null ? candidate : {}
  const settingsSource =
    typeof base.settings === 'object' && base.settings !== null ? base.settings : base

  const normalized = {
    id:
      typeof base.id === 'string' && base.id.trim() !== ''
        ? base.id
        : `scenario-${index + 1}-${createId()}`,
    name:
      typeof base.name === 'string' && base.name.trim() !== ''
        ? base.name
        : `${FALLBACK_SCENARIO.name} ${index + 1}`,
    color:
      typeof base.color === 'string' && base.color.trim() !== ''
        ? base.color
        : undefined,
    settings: {
      ...FALLBACK_SCENARIO.settings,
      ...settingsSource,
    },
  }

  if (!normalized.color || usedColors.has(normalized.color)) {
    normalized.color = getNextColor(usedColors)
  } else {
    usedColors.add(normalized.color)
  }

  const target = Number(normalized.settings.targetBalance)
  normalized.settings.targetBalance = Number.isFinite(target) ? target : 0

  return normalized
}

function normalizeConfig(input) {
  if (!input) {
    return cloneConfig(DEFAULT_CONFIG)
  }

  const usedColors = new Set()

  if (Array.isArray(input)) {
    const scenarios = input
      .map((scenario, index) => normalizeScenario(scenario, index, usedColors))
      .filter(Boolean)

    return {
      scenarios: scenarios.length ? scenarios : cloneConfig(DEFAULT_CONFIG).scenarios,
    }
  }

  if (isCompoundSettings(input)) {
    return {
      scenarios: [
        normalizeScenario(
          {
            ...FALLBACK_SCENARIO,
            settings: {
              ...FALLBACK_SCENARIO.settings,
              ...input,
            },
          },
          0,
          usedColors,
        ),
      ],
    }
  }

  if (typeof input === 'object' && input !== null && Array.isArray(input.scenarios)) {
    const scenarios = input.scenarios
      .map((scenario, index) => normalizeScenario(scenario, index, usedColors))
      .filter(Boolean)

    return {
      scenarios: scenarios.length ? scenarios : cloneConfig(DEFAULT_CONFIG).scenarios,
    }
  }

  return cloneConfig(DEFAULT_CONFIG)
}

async function readConfig() {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return cloneConfig(normalizeConfig(parsed))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to read persisted settings', error)
    }
    return cloneConfig(DEFAULT_CONFIG)
  }
}

async function writeConfig(payload) {
  const normalized = normalizeConfig(payload)
  const filePath = getConfigPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

module.exports = {
  DEFAULT_SETTINGS: DEFAULT_CONFIG,
  readConfig,
  writeConfig,
}
