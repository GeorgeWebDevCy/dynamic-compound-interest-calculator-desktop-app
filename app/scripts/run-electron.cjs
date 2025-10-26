#!/usr/bin/env node
const { spawn } = require('node:child_process')
const {
  constants: { signals: signalNumbers },
} = require('node:os')

const electronBinary = require('electron')
const mode = process.argv[2] ?? 'prod'
const childEnv = { ...process.env }

if (!childEnv.NODE_ENV) {
  childEnv.NODE_ENV = mode === 'dev' ? 'development' : 'production'
}

const electronArgs = ['.']
const child = spawn(electronBinary, electronArgs, {
  stdio: ['inherit', 'inherit', 'pipe'],
  env: childEnv,
})

let stderrBuffer = ''
child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString()
  process.stderr.write(chunk)
})

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', forwardSignal)
process.on('SIGTERM', forwardSignal)
process.on('exit', () => {
  if (!child.killed) {
    child.kill()
  }
})

child.on('close', (code, signal) => {
  if (signal) {
    const signalNumber = signalNumbers?.[signal]
    const exitCode = typeof signalNumber === 'number' ? 128 + signalNumber : 1

    process.exit(exitCode)
    return
  }

  if (code && code !== 0) {
    const missingLibMatch = stderrBuffer.match(/error while loading shared libraries: ([^:]+):/i)

    if (missingLibMatch) {
      const missingLib = missingLibMatch[1]
      const suggestions = {
        'libatk-1.0.so.0':
          'Install the "libatk1.0-0" package on Debian/Ubuntu or "atk" on Fedora/Arch based systems.',
        'libgtk-3.so.0':
          'Install the "libgtk-3-0" package on Debian/Ubuntu or "gtk3" on Fedora/Arch based systems.',
      }

      const suggestion = suggestions[missingLib] ??
        'Install the Electron runtime dependencies for your Linux distribution.'

      console.error('\nElectron could not start because the system library "' + missingLib + '" is missing.')
      console.error('Hint: ' + suggestion)
      console.error('For CI or container environments install the required GTK/ATK packages, or run the renderer with "npm run dev:renderer".')
    }
  }

  process.exit(code ?? 1)
})
