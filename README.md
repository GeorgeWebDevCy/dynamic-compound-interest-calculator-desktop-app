# Dynamic Compound Interest Calculator Desktop App

Cross-platform Electron + React desktop experience that models compound interest scenarios with presets tuned for the Freedom24 custody account investing into Vanguard S&P 500 UCITS ETF (ticker: VUAA.EU). Every input change re-computes the growth curve, shows a chart/table breakdown, and persists the latest configuration to disk so you can continue where you left off.

## Screenshots

![Primary dashboard view showing inputs](/docs/screenshots/1.png)

![Primary dashboard view showing waterfall stats, and growth chart](/docs/screenshots/2.png)

![Table and formulas view highlighting yearly breakdown plus projection math](/docs/screenshots/3.png)

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
| Initial principal | €2,000 | Typical first transfer when opening a new Freedom24 custody account |
| Periodic contribution | €500 monthly | Automatic monthly top-up |
| Expected return | 9.5% | Historical S&P 500 average |
| Compounding | Monthly | Aligns with ETF distribution |
| Fund expense ratio | 0.07% | VUAA.EU TER |
| Platform fee | 0.50% | Freedom24 custody fee |

Use the “Reset to preset” button in the UI if you want to return to these values.

### How VUAA.EU works on Freedom24

- **ETF basics**: VUAA.EU is the accumulating share class of the Vanguard S&P 500 UCITS ETF traded on Xetra. It reinvests dividends back into the fund, so account growth comes entirely from price appreciation.
- **Freedom24 settlement**: Purchases settle in euros inside your Freedom24 custody account. The platform charges a 0.50% annual custody fee, which the app models as the “Platform fee.”
- **Order execution**: Freedom24 forwards market or limit orders to Xetra during trading hours. The ETF is denominated in USD, so Freedom24 handles FX conversion automatically when funding with euros, applying its prevailing conversion spread.
- **Ongoing contributions**: Scheduling recurring transfers into the custody account ensures that each monthly contribution is available for automatic or manual ETF purchases, matching the calculator’s monthly compounding assumption.

### Compound interest primer

Compound interest is the process of reinvesting growth so that each period’s returns build on the principal plus prior gains. The calculator applies this by:

1. Starting with the initial principal.
2. Adding the monthly contribution.
3. Applying the net annual return (market performance minus fund expenses and platform fees) prorated across the chosen compounding frequency.
4. Repeating the cycle for the duration you set, which produces an exponential growth curve rather than a straight line.

Because VUAA.EU automatically reinvests dividends, the ETF itself behaves like a compound-interest engine: every distribution stays in the fund, and Freedom24 reports the increasing share count and value in euros.

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

## Installation

Packaged binaries live under `app/dist/` once you run the platform-specific `npm run package -- --<os>` command, or you can download them from the releases page. Full, step-by-step instructions (including screenshots for AppImage on Ubuntu) are available in `docs/installation.md`, but here is the quick reference:

- **Windows (NSIS/MSI)**: run the installer, click through SmartScreen if needed, and launch Dynamic Compound Interest from the Start Menu. Uninstall via *Settings → Apps*.
- **macOS (DMG)**: open the DMG, drag the app into `Applications`, then approve the first run under *System Settings → Privacy & Security* if Gatekeeper warns about an unsigned developer.
- **Linux (AppImage)**: install `libfuse2` if it is missing, make the `.AppImage` executable (`chmod +x`), and run it (`./Dynamic\ Compound\ Interest-<version>.AppImage`). Optionally integrate it with AppImageLauncher for menu entries.

Each platform stores the user configuration in its native `userData` path (see below) so reinstalling/upgrading preserves your latest inputs.

## Withdrawal schedule helper

The “Allowed withdrawal (4%)” column now exposes the calendar date when the withdrawal becomes available, plus a tooltip in the column header that mirrors the in-app format. The tooltip summarizes the first N years (matching the duration you set in the inputs) using the exact string rendered in the app:

```
Year 5 → €12,300 on 31/12/2029
Year 6 → €12,900 on 31/12/2030
+4 more years
```

When you highlight this feature in release notes or support docs, copy the snippet above (or the localized version under `table.withdrawalScheduleTooltip`) so end users see the same structure they find in the UI.

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

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Schema org.gnome.desktop.interface does not have key font-antialiasing` (Electron exits on Linux) | Install/reinstall `gsettings-desktop-schemas`, run `sudo glib-compile-schemas /usr/share/glib-2.0/schemas`, and ensure `GSETTINGS_SCHEMA_DIR` points to that folder (the app now sets it automatically when readable). You can verify the fix with `gsettings get org.gnome.desktop.interface font-antialiasing`. GPU is disabled by default on Linux; set `ELECTRON_ENABLE_HARDWARE_ACCELERATION=true` to opt back in once the schema works. |
