# Changelog

## 0.7.0 - 2026-10-15

The repository now maintains the Windows desktop edition for DeepSeek Harness 0.2.0-rc.2, replacing the deprecated WebUI-only edition on the default branch. Historical releases remain available.

- Full six-tab React editor hosted in native desktop slots, with live preview, cancellation and protected saves.
- Seventeen bundled base, character and group presets, including local media and bilingual copy.
- Desktop-specific component, visual asset and text targets; reliable theme/media/font cleanup.
- `.dshskin` v5 compatibility and backed-up migration of earlier desktop data.
- Windows installer using the desktop application's bundled pnpm, with profile backup and dry-run support.
- Portable diagnostic paths, npm-based Windows/Linux CI and 101 automated checks.

The desktop package is distributed through GitHub Releases. The historical npm package remains the WebUI edition. The installed package identifier and desktop storage namespace are preserved for existing desktop users.
