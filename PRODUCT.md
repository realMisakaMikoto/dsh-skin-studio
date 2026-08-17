# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, React, CSS Modules, pnpm, tsdown, and Vitest, packaged as a DeepSeek Harness Web plugin.

## Users

DeepSeek Harness users who want to create and switch distinctive interface skins without editing source code. The primary workflow happens inside DSH Settings and must remain approachable to non-technical users.

## Product Purpose

dsh-skin-studio lets people create, save, preview, activate, import, and export multiple DSH skins. A skin carries light and dark colors, a main image or looping video background, media backgrounds assigned to visible component types, UI/code fonts, semantic replacements for selected built-in DSH visuals, and localized interface-copy overrides in a portable package.

## Positioning

Unlike single-setting theme panels, the product treats skins as reusable library items and exports the complete visual result, including local assets, as a safe `.dshskin` package that can be edited again.

## Operating Context

The plugin is installed into the DSH `web` profile and appears under Settings -> General. Native light, dark, and system appearance preferences continue to control the active palette mode.

## Capabilities and Constraints

- Basic semantic color editing plus guided controls for inputs, buttons, sidebars, messages, code, borders, and status colors.
- An all-token view for runtime-exposed colors and the plugin's verified DSH component-color allowlist.
- Automatic light/dark counterpart generation with independent editing afterward.
- Browser-local IndexedDB persistence and same-origin tab synchronization.
- PNG, JPEG, WebP, MP4, or WebM background media and WOFF2 font assets only.
- A visual picker for assigning independent image or muted looping video backgrounds to any visible DSH component type.
- A versioned Visual Asset Slot catalog for safe PNG/JPEG/WebP replacement of stable DSH brand, hero, and workspace visuals.
- A bilingual Copy Slot catalog for selected stable DSH labels and placeholders, rendered only as plain text.
- No arbitrary CSS, HTML, JavaScript, selectors in the manifest, Host-side sync, online marketplace, layout editing, or global radius editing in v4.

## Brand Commitments

The public project and package name is `dsh-skin-studio`. UI copy is available in Chinese and English. The plugin inherits DSH's interface tokens and interaction language.

## Evidence on Hand

No original imagery, logo, or customer claims are available. The plugin must not invent endorsements or usage metrics.

## Product Principles

- Preserve DSH behavior while changing its appearance.
- Make safe choices easy without taking creative control away.
- Treat every exported skin as portable, inspectable data.
- Always make preview, persistence, and recovery states explicit.

## Accessibility & Inclusion

Keyboard operation, visible focus, localized controls, and WCAG contrast reporting are required. Low-contrast skins may be applied only after an explicit warning.
