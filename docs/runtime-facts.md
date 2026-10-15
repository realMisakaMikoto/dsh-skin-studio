# Desktop runtime evidence

Baseline: installed DeepSeek Harness 0.2.0-rc.2 on Windows, inspected and exercised on 2026-10-02. Plugin package: @local/dsh-desktop-skin-studio 0.2.0.

## Integration

The profile dependency remains linked to this checkout and the package remains bundle 4 of 4. Other profile plugins and configuration are preserved. The upstream WebUI studio remains disabled.

The browser artifact registers one lazy factory matching the package name. Only react and react/jsx-runtime are requested from the platform table; fflate is bundled. Factory materialization creates no DOM. The parent entry declares inject=[], then waits for slots/theme/locale in an inner disposable context.

settings.general.item registers the launcher; shell.overlay registers the persistent React studio. The dialog uses native showModal, with its header, tab strip and action footer outside the page scroller. The installed layout declares both slots. The plugin's fifty generated theme tokens all exist in the installed vocabulary of 422.

## Desktop structural differences

The desktop hero title/badge live inside nested title-group spans. The composer uses contenteditable with a data-placeholder and separate hint overlay, rather than a textarea. Fixed copy updates these hints without changing user input. Sidebar new-session copy lives inside nested spans. Folder SVG paths changed in 0.2.0-rc.2. The desktop adaptation recognizes these structures.

Character presets retain portable upstream targets in their manifests; the applier maps the known upstream component names to the inspected desktop component structures. Unknown targets remain unresolved rather than becoming broad CSS selectors.

## Persistence and lifecycle

IndexedDB dsh-desktop-skin-studio v2 keeps skins/assets and adds migration-backups. The v1 backup includes original rows and snapshot. Backup and record conversion share the upgrade transaction; snapshot rewriting happens after commit and cannot overwrite a later selection. Invalid records stay intact and are reported. The upstream database namespace is not modified.

One applier controls active and preview appearances. Switching, canceling, restoring default and unloading release theme layers, DOM changes, media, observers, fonts and object URLs. Revision checks discard stale asynchronous font/asset results. Persisted skin selection restores after a full desktop restart.

## Verification

The test suite covers upstream model/package behavior, all fourteen embedded media-package roundtrips, storage migration/rollback, controller lifecycle, actual React dialog interactions, picker flows, video playback setup, font cleanup and stable text/visual reapplication.

The installed Electron app has been opened through Playwright, rather than relying on a mocked DOM. Its status endpoint reported ready=true, persistent=true, skinCount=17 and a successful migration of all three legacy base presets. Six pages, role artwork, branded icons, safe input hints and both 1280x720 and 1920x1080 viewports were inspected. Temporary acceptance skins are removed after verification.

`npm run verify` performs typecheck, build, syntax validation, package checks and Vitest. `npm run verify:client` checks the queue-mode boot contract and scoped activation. `npm run check:install` checks the actual profile mount; `npm run drift` verifies installed tokens and slot declarations.

Use a full quit/reopen after installing or rebuilding while testing the shipped desktop application. Startup telemetry and connection errors during process shutdown must be distinguished from a failed plugin activation. Diagnostic status is available at /dsh-desktop-skin-studio/status.
