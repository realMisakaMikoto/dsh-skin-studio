---
name: DSH Desktop Skin Studio
description: The upstream six-tab skin editor adapted to the desktop renderer.
colors:
  bg-base: "#ffffff"
  bg-layer-1: "#f7fafb"
  bg-layer-2: "#edf3f5"
  border-l1: "#dce5e8"
  border-l2: "#bdcdd2"
  brand-primary: "#0b7598"
  button-primary-hover: "#096783"
  label-primary: "#17272b"
  label-secondary: "#52666c"
  label-tertiary: "#718187"
  state-error-primary: "#b4232d"
  state-success-primary: "#0b6b3a"
  state-warn-primary: "#8a4b00"
  dark-bg-base: "#15191b"
  dark-bg-layer-1: "#20272a"
  dark-bg-layer-2: "#2b3438"
  dark-border-l1: "#35464c"
  dark-border-l2: "#50636a"
  dark-brand-primary: "#67c5e3"
  dark-button-primary-hover: "#82d0e8"
  dark-label-primary: "#eff5f6"
  dark-label-secondary: "#b5c2c6"
  dark-label-tertiary: "#91a2a8"
  dark-state-error-primary: "#ff8a8a"
  dark-state-success-primary: "#74db9e"
  dark-state-warn-primary: "#ffd079"
typography:
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  button:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  compact-button:
    fontSize: "13px"
  description:
    fontSize: "13px"
  review:
    fontSize: "12px"
rounded:
  compact-control: "8px"
  field: "10px"
  button: "12px"
  dialog: "20px"
  status-pill: "999px"
spacing:
  tight: "6px"
  small: "8px"
  field: "10px"
  row: "12px"
  control: "14px"
  group: "16px"
  panel: "20px"
  section: "24px"
  section-gap: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.bg-base}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.button-primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.label-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.label-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
  button-compact:
    typography: "{typography.compact-button}"
    rounded: "{rounded.compact-control}"
    padding: "4px 9px"
  input:
    backgroundColor: "{colors.bg-base}"
    textColor: "{colors.label-primary}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.label-secondary}"
    padding: "0 14px"
    height: "38px"
  compatibility-status:
    textColor: "{colors.state-warn-primary}"
    rounded: "{rounded.status-pill}"
    padding: "3px 8px"
  visual-preview:
    backgroundColor: "{colors.bg-layer-1}"
    textColor: "{colors.label-tertiary}"
    rounded: "{rounded.button}"
    padding: "14px"
    height: "116px"
---

# Design System: DSH Desktop Skin Studio

## Overview

**Creative North Star: "The upstream Skin Studio"**

Visitor mode is Operate: a readable editing tool with the original six-tab workflow and control vocabulary. Visual authority is the user-selected dsh-skin-studio 0.6.0-alpha.1 reference, pinned at a10dc1b57f2d7b00636eb0ac96536d01128a9e56. The desktop adaptation retains that identity.

Neutral editor surfaces protect the controls while a skin changes the surrounding app. Compact forms, separated list rows and paired original/custom previews keep dense editing tasks legible. The desktop wrapper uses the web platform and a native HTML dialog.

**Key Characteristics:**

- Protected light and dark editor palettes.
- Six-tab navigation with independent page scrolling.
- Compact labeled controls and parallel row actions.
- Visible compatibility, storage and save feedback.
- Reversible preview with keyboard-accessible controls.

## Colors

The editor pairs cool neutral surfaces with a restrained cyan-blue action accent. The frontmatter records the reused modal palette from src/client/studio.module.css; keys retain the source aliases' role names. A dark-prefixed token replaces the corresponding light token when the host sets its dark-theme attribute.

### Primary

- **Studio Blue** (brand-primary): primary actions, selected-tab underlines, keyboard focus and slider accents.
- **Studio Blue Hover** (button-primary-hover): primary-button hover state.
- **Bright Studio Blue** (dark-brand-primary): the same action role on dark surfaces.

### Neutral

- **Editor Base** (bg-base): dialog, input and selected segment surfaces.
- **Subtle Surface** (bg-layer-1): original/custom previews and reference-copy blocks.
- **Grouped Surface** (bg-layer-2): storage status and segmented-control tracks.
- **Fine Divider** (border-l1): row, page and footer separation.
- **Control Border** (border-l2): inputs, outlined actions and swatch edges.
- **Primary, Secondary and Tertiary Labels** (label-primary, label-secondary, label-tertiary): headings and values, supporting labels, and lower-priority or disabled content.

### Semantic States

Error, success and warning tokens communicate failures, active/available status and compatibility or readability concerns. Warning surfaces mix the warning color with the editor base; their text uses the protected label palette.

**The Protected Editor Rule.** Skin palette changes belong to the app preview. Preserve the editor's own light/dark control palette so an edited skin cannot obscure its editing controls.

## Typography

The dialog uses the system sans-serif stack. Its explicit title, body and button declarations are recorded in the frontmatter. Section, label and code roles inherit the host's existing DSW font aliases; retain those aliases rather than introducing a new typeface.

- **Title:** the dialog heading uses the explicit title role.
- **Body:** the dialog establishes the base role; fields and tabs use the host's small text alias.
- **Section:** group headings use the host's base-strong-16 alias.
- **Labels and supporting copy:** the host's xs-13 alias; the dialog description also has an explicit description size.
- **Review:** footer warnings and review copy use the compact review role.
- **Code:** component selectors and token names use the host's markdown-code alias.

Explanatory paragraphs commonly stop at 62-72 characters per line. Numeric slider outputs align to the right and use tabular figures. Strong text identifies sections and row names; avoid an oversized display hierarchy in this editing tool.

## Layout

The centered dialog is at most 960px wide and 820px high. Its desktop inset accounts for the native window's top chrome and keeps a 16px margin elsewhere. The content uses 24px top/side padding and 16px bottom padding; the action footer has its own divider and padding.

Header, six-tab navigation and footer remain visible while the active page scrolls. Page height is capped at the smaller of 560px or the viewport minus 260px. The library uses a swatch/name/actions grid; identity and media comparisons use two columns, and basic colors use three. Repeated field gaps follow the frontmatter spacing scale.

At widths of 760px or less, form and comparison grids become one column, library actions move below their entry, token editors align to the start, and long control rows stack. Tabs retain horizontal overflow. The desktop dialog uses 8px horizontal margins and smaller internal padding. At heights of 640px or less, page spacing contracts and the body height budget adjusts.

**The Visible Actions Rule.** Scroll the active page inside the dialog. Keep navigation and apply/cancel actions outside that page scroller.

## Elevation & Depth

Depth comes mainly from tonal surfaces and fine dividers. The dialog alone receives a broad structural shadow above the host. Selected segmented controls use a small lift within their muted track.

- **Dialog:** the source shadow is `0 20px 70px #0004`.
- **Selected segment:** `0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)`.
- **Backdrop:** a translucent black overlay starts below the host's window chrome.

The editor adds no decorative animation. Its reduced-motion rule removes tab and segmented-control transitions; preview media follows the reduced-motion preference.

## Shapes

The native dialog has the largest rounded silhouette. Regular buttons and media frames use the button radius, fields and grouped surfaces use the field radius, and compact buttons, token swatches and selected segments use the compact-control radius. Compatibility badges use the status-pill radius.

List and semantic editing rows stay flat, separated by a fine bottom border. Media frames contain assets without cropping them; palette strips clip four equal swatches into a single rounded frame.

## Components

### Buttons

Primary actions use Studio Blue with editor-base text. Ghost actions keep a transparent background; outlined actions add the control border. Regular actions have a 36px minimum height, while compact actions have a 28px minimum. Hover uses the existing host interactive surface or the primary hover color. Keyboard focus is a 2px accent outline with a 2px offset. Disabled actions reduce opacity and show the unavailable cursor.

### Inputs / Fields

Text, select and multiline controls use the editor base, control border and field radius. Labels sit above controls with a tight gap. Color editing pairs a native color well with a text value; sliders display their numeric output. Preserve native input semantics and the visible keyboard focus outline.

### Navigation

Six tabs use compact labels, a fine baseline and a 2px accent underline on the selected tab. Selected text becomes strong. Disabled tabs visibly recede. At narrow widths the strip can scroll horizontally without hiding page controls.

### Segmented Controls

Light/dark and editing-mode groups sit on the grouped surface. The selected segment uses the editor base, primary text and the small segment shadow. Keep pressed state available to assistive technology.

### Library Rows

Each flat row pairs a four-color swatch strip with a name, description and parallel actions. The name can ellipsize within its column. Actions wrap and move below the entry in the compact layout.

### Compatibility Status

A small semantic pill states whether a target is available. Its warning or success tone complements the text label. Storage status, failures, pending-save status and readability review remain visible near the affected action.

### Visual Comparisons

Original and custom previews appear side by side in equal frames with captions and compatibility details. Frames use the subtle surface and contain the supplied visual. The compact layout stacks the pair.

### Dialog and Footer

Use the native modal focus boundary, labeled heading and close control. Escape requests cancellation, and returning from pickers or closing the editor restores focus. The footer holds preview cancellation, apply/save and any required readability acknowledgment.

## Do's and Don'ts

### Do:

- **Do** preserve the pinned upstream editor's six-tab structure and interaction vocabulary.
- **Do** keep the editor controls readable in both light and dark host modes.
- **Do** keep page scrolling independent from navigation and footer actions.
- **Do** use labels, current values and visible compatibility feedback together.
- **Do** preserve native dialog and input semantics, keyboard focus and focus restoration.
- **Do** use paired original/custom previews and honor reduced-motion preferences.

### Don't:

- **Don't** apply edited skin colors or media to the protected editor controls.
- **Don't** replace the compact editing hierarchy with a new promotional visual identity.
- **Don't** let a long page scroll its apply/cancel controls out of view.
- **Don't** substitute color alone for compatibility, warning or failure text.
