# Changelog

## 0.7.0 - 2026-10-15

The repository now maintains the Windows desktop edition for DeepSeek Harness 0.2.0-rc.2, replacing the deprecated WebUI-only edition on the default branch. Historical releases remain available.

- Full six-tab React editor hosted in native desktop slots, with live preview, cancellation and protected saves.
- Seventeen bundled base, character and group presets, including local media and bilingual copy.
- Desktop-specific component, visual asset and text targets; reliable theme/media/font cleanup.
- `.dshskin` v5 compatibility and backed-up migration of earlier desktop data.
- Windows installer using the desktop application's bundled pnpm, with profile backup and dry-run support.
- Portable diagnostic paths, npm-based Windows/Linux CI and 103 automated checks.
- Same-version revision: contain wallpaper decoration at the document viewport without changing conversation panel scrolling, and restore original overflow styles on switching or unloading.

The desktop package is distributed through GitHub Releases and the original public npm name, `dsh-skin-studio@0.7.0`. The public npm artifact adapts the package identity from the immutable release source; the existing local checkout keeps its installed identifier and desktop storage namespace. Versions through `0.6.0-alpha.1` remain the WebUI edition.
