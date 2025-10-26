# Installation Guide

This guide explains how to install the Dynamic Compound Interest desktop app on Windows, macOS, and Linux. All installers are produced from the `app/dist/` directory after running `npm run package` on the respective platform or can be downloaded from the releases page if you are consuming a published build.

## Windows

1. Download the `.exe` (NSIS) or `.msi` installer that matches your architecture.
2. Double-click the installer. If Windows SmartScreen warns about an unknown publisher, select **More info → Run anyway** (until the app is codesigned).
3. Follow the prompts. The installer adds a shortcut to the Start Menu and optionally the desktop.
4. Launch “Dynamic Compound Interest” from the Start Menu. User data is stored under `%AppData%\Dynamic Compound Interest`.

### Uninstall

Use *Settings → Apps → Installed apps* (Windows 11) or *Control Panel → Programs and Features* (Windows 10) to remove the app.

## macOS

1. Download the `.dmg` disk image.
2. Double-click the DMG, then drag **Dynamic Compound Interest.app** into the **Applications** folder shortcut.
3. On first launch, Gatekeeper may block the unsigned app. Open *System Settings → Privacy & Security*, scroll to the warning, and click **Open Anyway**. After approval, you can start the app from Spotlight or Launchpad.
4. Configuration is stored at `~/Library/Application Support/Dynamic Compound Interest`.

### Uninstall

Delete `Dynamic Compound Interest.app` from `/Applications` and optionally remove the configuration folder above.

## Linux (AppImage)

1. Download the `.AppImage` file (for Ubuntu and most modern distros).
2. Ensure AppImage prerequisites are installed (Ubuntu 22.04+ ships with `libfuse2`; older releases require `sudo apt install libfuse2`).
3. Mark the AppImage as executable:

   ```bash
   chmod +x Dynamic\ Compound\ Interest-<version>.AppImage
   ```

4. Run the app directly:

   ```bash
   ./Dynamic\ Compound\ Interest-<version>.AppImage
   ```

   The window launches immediately; no installation directory is created.

5. Optional desktop integration:
   - Use [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) or run `./Dynamic\ Compound\ Interest-<version>.AppImage --appimage-install` to copy the AppImage under `~/.local/bin` and create menu entries.

### Uninstall

Delete the AppImage (and any integration files under `~/.local/share/applications` if you used AppImageLauncher). App settings live in `~/.config/Dynamic Compound Interest`.

---

Need to build the installers yourself? See the developer instructions in `app/README.md` for packaging commands.
