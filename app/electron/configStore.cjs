const fs = require('node:fs/promises')
const path = require('node:path')
const { app } = require('electron')

const DEFAULT_SETTINGS = require('../src/shared/default-settings.json')

const getConfigPath = () =>
  path.join(app.getPath('userData'), 'dynamic-compound-config.json')

async function readConfig() {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to read persisted settings', error)
    }
    return { ...DEFAULT_SETTINGS }
  }
}

async function writeConfig(payload) {
  const filePath = getConfigPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

module.exports = {
  DEFAULT_SETTINGS,
  readConfig,
  writeConfig,
}
