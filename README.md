# Dynamic Compound Interest Calculator Desktop App

Cross-platform Electron + React desktop experience that models compound interest scenarios with presets tuned for the Freedom24 custody account investing into Vanguard S&P 500 UCITS ETF (ticker: VUAA.EU). Every input change re-computes the growth curve, shows a chart/table breakdown, and persists the latest configuration to disk so you can continue where you left off.

## Screenshots

![Primary dashboard view showing inputs](../docs/screenshots/1.png)

![Primary dashboard view showing waterfall stats, and growth chart](../docs/screenshots/2.png)

![Table and formulas view highlighting yearly breakdown plus projection math](../docs/screenshots/3.png)

## Project layout

```
.
├── LICENSE
├── README.md          ← you're here
└── app/               ← Electron + React source (Vite, TypeScript)
    ├── electron/      ← main & preload processes + config store
    ├── src/           ← renderer UI and finance helpers
    └── shared/        ← defaults shared between renderer/electron
```

## Freedom24 + VUAA defaults

The app ships with the following assumptions that match a common Freedom24 + VUAA.EU setup:

| Input | Default | Notes |
| --- | --- | --- |
| Initial principal | €2,000 | Typical first transfer for D-account users |
| Periodic contribution | €500 monthly | Automatic monthly top-up |
| Expected return | 9.5% | Historical S&P 500 average |
| Compounding | Monthly | Aligns with ETF distribution |
| Fund expense ratio | 0.07% | VUAA.EU TER |
| Platform fee | 0.50% | Freedom24 custody fee |

Use the “Reset to preset” button in the UI if you want to return to these values.

## Requirements

- Node.js 20.16+ (LTS) and npm 10+
- Git (for cloning/committing)
- Windows, macOS, or Linux environment capable of running Electron 32

## Getting started

```powershell
git clone <repo> dynamic-compound-interest-calculator-desktop-app
cd dynamic-compound-interest-calculator-desktop-app/app
npm install
```

### Development workflow

- **Windows**: `npm run dev`
- **macOS**: `npm run dev`
- **Linux**: `npm run dev`

The command launches the Vite dev server plus an Electron window that hot-reloads whenever you edit the renderer or Electron process files.

### Production build / packaging

Run the following from the `app/` directory:

| Platform | Command | Artifacts | Notes |
| --- | --- | --- | --- |
| Windows (NSIS + MSI) | `npm run package -- --win` | `Dynamic Compound Interest-<version>.exe` and `.msi` in `app/dist/` | Run on Windows with Developer Mode or elevated privileges so electron-builder can create symlinks during codesign bootstrap. Uses `build/icons/icon.ico`. |
| macOS (DMG) | `npm run package -- --mac` | Signed/unsigned `.dmg` in `app/dist/` | Must run on macOS; notarization requires an Apple Developer ID and associated environment variables. |
| Linux (AppImage) | `npm run package -- --linux` | `.AppImage` in `app/dist/` | Must run on a Linux host (electron-builder cannot produce AppImage on Windows without WSL). Requires `fuse`/`libappimage` available. |

Electron Builder detects the host OS automatically. Cross-packaging (e.g., building a macOS binary on Windows) requires the respective platform tooling or CI matrix.

### Useful scripts

```bash
npm run lint      # lint renderer + Electron sources
npm run build     # produce static renderer assets (dist/)
npm run start     # launch Electron in production mode after a build
```

## Persisted configuration

The most recent inputs are cached in `dynamic-compound-config.json` inside Electron’s `userData` folder, which differs per platform:

| Platform | Location |
| --- | --- |
| Windows | `%AppData%\Dynamic Compound Interest\dynamic-compound-config.json` |
| macOS | `~/Library/Application Support/Dynamic Compound Interest/dynamic-compound-config.json` |
| Linux | `~/.config/Dynamic Compound Interest/dynamic-compound-config.json` |

Delete that file to return to the built-in Freedom24 + VUAA defaults, or use the in-app reset.

## Release process

Follow these steps when preparing the GitHub release for v1.0.0 (adapt as needed for future tags):

1. **Verify quality**: run `npm run lint`, `npm run test`, and `npm run build` from `app/` to ensure the renderer, Electron processes, and shared helpers are healthy.
2. **Update versioning**: bump the semver in `app/package.json` (which also updates `package-lock.json`) and note the change in the release notes draft.
3. **Package installers**: execute the platform-specific `npm run package` commands above on Windows, macOS, and Linux hosts; collect the installers from `app/dist/`.
4. **Draft release notes**: summarize highlights, link to any key issues, and list checksums for each installer.
5. **Publish on GitHub**: create the `v1.0.0` tag, upload the installers as assets, paste the notes, and double-check download links before publishing.
