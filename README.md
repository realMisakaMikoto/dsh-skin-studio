# DSH Skin Studio · Desktop

[中文说明](README.zh.md) · [Download](https://github.com/realMisakaMikoto/dsh-skin-studio/releases) · [Report an issue](https://github.com/realMisakaMikoto/dsh-skin-studio/issues)

Create, preview and share complete skins in **DeepSeek Harness for Windows**. This repository now maintains the desktop edition, succeeding the deprecated WebUI-only 0.6.0-alpha.1.

Tested with **DSH desktop 0.2.0-rc.2**. Other desktop versions and operating systems are not yet verified. Historical WebUI releases remain available in the [release archive](https://github.com/realMisakaMikoto/dsh-skin-studio/releases/tag/0.6.0-alpha.1).

## Install

1. Start DSH desktop once to initialize its desktop profile, then save your work and quit it.
2. Install Node.js 22 or newer if `node --version` is unavailable.
3. Download the desktop release's **Source code (zip)** or `.tgz` archive and extract it to a permanent folder.
4. Double-click `install-desktop.cmd`, or run `node scripts/install-desktop.mjs` from that folder.
5. Reopen DSH. Open **Account menu → Settings → General → Custom skins → Open skin studio**.

The source archive includes the prebuilt client and all preset media. No build step is needed to install a release. Keep the extracted folder: your desktop profile links to it. The installer backs up the selected profile, installs this package using DSH's bundled pnpm, and enables it without altering other plugins' settings.

For custom installations:

```sh
node scripts/install-desktop.mjs --profile "D:/DSH/profile" --resources "D:/DSH/resources" --dry-run
node scripts/install-desktop.mjs --profile "D:/DSH/profile" --resources "D:/DSH/resources"
```

The global `dsh plugin --profile desktop add` command may reject desktop profiles because they are managed by Electron; use the included installer. GitHub release archives are the distribution channel for this desktop package. The old npm `dsh-skin-studio` package belongs to the historical WebUI line.

## Complete skin editing

| Page | Features |
| --- | --- |
| Library | Create, duplicate, edit, activate, delete and restore DSH defaults |
| Basic editor | Light/dark palettes, OKLCH generation, image/video wallpaper and WOFF2 fonts |
| GUI components | Token groups/search, component picker, per-component media, opacity and blur |
| Visual assets | Five semantic image positions, original/custom previews and sidebar branding |
| Copy | Bilingual fixed copy, structured text targets and input hints |
| Import & export | Portable `.dshskin` v5 packages, resource validation and conflict choices |

Seventeen complete presets are bundled: Bright Studio, High Contrast, Tidal Paper, thirteen Nijigasaki character skins and one group skin. Media is included locally. Edited presets survive updates.

Edits preview live. **Apply & save** persists and activates the draft; **Cancel preview** restores the previous skin. The editor reports contrast/readability concerns and protects unsaved changes. Pickers support mouse/keyboard, F2 mode switching and Esc return. Visual positions that do not exist in the current view are reported and left unchanged.

## Storage and migration

Desktop data lives in the independent `dsh-desktop-skin-studio` IndexedDB namespace. A lightweight localStorage snapshot restores the active skin at startup. The original WebUI database is untouched; use `.dshskin` files to move skins between editions.

Legacy desktop v1 data upgrades transactionally to v2 with original rows and snapshot retained in `migration-backups`. Unconvertible records remain preserved with visible warnings. Switching skins, restoring defaults, cancelling preview and unloading release media, fonts, observers and object URLs.

## Development

```sh
npm ci
npm run verify
npm run verify:client
npm pack
```

Edit TypeScript/TSX/CSS Modules in `src/`, then run `npm run build`. The lazy `client.js` is generated with tsdown. React comes from the host's platform table; the plugin does not import private Harness Client packages or create a second renderer.

CI verifies Node.js 22/24 on Windows and Linux; desktop runtime support is Windows only. Optional installed-host checks are `npm run check:install`, `npm run asar` and `npm run drift`. Override `DSKIN_RESOURCES_DIR`, `DSKIN_DSH_ROOT`, `DSH_HOME` or `DSH_PROFILE_DIR` for nonstandard locations.

See [runtime notes](docs/runtime-facts.md), [verification history](docs/verification.md), [v5 format](docs/skin-format-v5.md) and [design documentation](DESIGN.md). Report your DSH version, plugin version and reproduction steps with issues.

## License

Source is **AGPL-3.0-only**, continuing the original project. Legacy desktop integration retains its MIT notice in `LICENSE.local-MIT`; bundled fflate is MIT. Character artwork and logos have separate rights and attribution in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).
