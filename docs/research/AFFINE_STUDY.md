# AFFiNE Visual & Interaction Study

Sources read locally: `toeverything/AFFiNE` @ `cfda4858` (2026-09-09) and its token package's own repo
`toeverything/design` @ `2ce2dfa5`. Paths below are relative to one of those two roots.

## 0. License verdict — MIT for everything we care about

Root `LICENSE` is a split license: _"All content that resides under the `packages/backend` and
`packages/common/native` directory … is licensed under the license defined in
`packages/backend/server/LICENSE`. … **Content outside of the above mentioned directories or
restrictions above is available under the "MIT" license** as defined in `LICENSE-MIT`."_
`LICENSE-MIT` is verbatim MIT. **No Commons Clause, no copyleft on the frontend.**
`packages/backend/server/LICENSE` (also at `packages/backend/native/LICENSE`) is the proprietary
"AFFiNE Enterprise Edition" license — subscription-gated, _"forbidden to copy, merge, publish,
distribute, sublicense, and/or sell"_. It covers only backend + common/native.

| Area                                                                         | License       | We may                                                                         |
| ---------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `packages/frontend/**`, `blocksuite/**`                                      | **MIT**       | Copy/adapt literally, with the MIT notice preserved                            |
| `packages/backend/**`, `packages/common/native/**`                           | AFFiNE EE     | Nothing — do not read or copy                                                  |
| nested vendored libs (`…/surface/src/utils/rough`, `perfect-freehand`)       | own MIT files | respect each nested LICENSE                                                    |
| `@toeverything/theme` token **source** (separate repo `toeverything/design`) | **MPL-2.0**   | depend on the package freely; a copied+modified token _file_ must stay MPL-2.0 |

**So: literal code adaptation of the shell and editor is permitted — we are not limited to
behavioural reimplementation.** For tokens we restate the _numbers_ (facts, not expression) in our own
Tailwind `@theme`, which avoids MPL entirely. Add an MIT attribution entry to
`THIRD_PARTY_NOTICES.md` only if we actually ship adapted code.

## 1. Editor page frame

`:root` vars from `design/packages/theme/src/index.ts` (`baseTheme`, emitted via `index.css.ts`):
`--affine-editor-width: 944px`, `--affine-editor-side-padding: 96px`,
`--affine-line-height: calc(1em + 8px)`, `--affine-paragraph-space: 8px`.

- **There is no "page card".** `affineDocViewport`
  (`…/detail-page/detail-page.css.ts:31`) uses `--affine-background-primary-color` — the _same_ white
  as the shell. Full-bleed surface, centred column, no shadow/border/paper metaphor.
- Column: `.affine-page-root-block-container` (`blocksuite/affine/blocks/root/src/page/page-root-block.ts:69-87`)
  — `max-width: var(--affine-editor-width); margin: 0 auto;
padding-left/right: var(--affine-editor-side-padding, 24px); padding-bottom: 32px`.
  `box-sizing: border-box` globally → **measure = 944 − 96 − 96 = 752px** (~85–90 chars at 15px).
  The 24px literal is only a no-var fallback. Comment at `:76`: _"Leave a place for drag-handle."_
- Breakpoint is a **CSS container**, not a media query: `@container viewport (width <= 640px)` →
  side padding 24px. It reacts to the sidebar, not the window. Full-width mode swaps to
  `100% / 72px` (`components/page-detail-editor.css.ts:9-13`).
- Vertical stack (`core/src/blocksuite/block-suite-editor/lit-adaper.tsx:257-297`):
  52px chrome header (`padding: 0 16px`) → viewport (`padding-bottom: 100px`) → icon slot (64×64,
  60px emoji) → title (`padding: 38px 0`, top padding dropped when an icon exists) → properties table
  (`padding-bottom: 18px`) → editor → `docEditorGap` (`padding: 50px 0`, `flex-grow: 1`,
  `cursor: text`, click focuses the last block) → starter bar → backlinks panel.
- Optional header image: `max-height: 240px; object-fit: cover; radius 8px; margin-bottom: 12px`.
- Header hairline is **scroll-reactive**: `border-top: 0.5px solid transparent;
transition: border-color 0.2s`, painted only when `[data-has-scroll-top="true"]`.

## 2. Sidebar

`core/src/modules/app-sidebar/views/` + shared `component/src/components/resize-panel/`.

- **Width 248px default, resize range 248 → 480px**, also clamped `max-width: 50%`
  (`views/index.tsx:38-39`, `entities/app-sidebar.ts:30`, `resize-panel.css.ts:21`). Persisted.
- **Gap between sidebar and content: `0px`.** Flush flex siblings
  (`desktop/components/app-container/styles.css.ts:41-66`); split panes also default `gap: 0px`
  (`split-view/split-view.css.ts:198`). The entire separation budget is:
  - sidebar `border-right: 0.5px solid layer/insideBorder/border` (`#e6e6e6` / `#414141`)
  - main container `border-top` + `border-left` `0.5px solid borderColor`, plus
    `border-top-left-radius: 6px` when the sidebar is open
  - **no shadow when docked.** Shadow + `radius 6px` + `margin-left: 4px` exist only in the
    floating/overlay state. The Electron-only "client border" mode is the sole place with a real gap
    (`padding: 8px`, `padding-left: 0` while open, 8px pane gap).
- Sidebar header **52px, `padding: 0 8px`** — matches the 52px content header exactly, so both sides
  align across the hairline. Body `gap: 4px`; scroll container `padding: 0 8px`, `gap: 8`.
- Composition (`components/root-app-sidebar/index.tsx:192-259`): workspace row (42px) → quick-search +
  new-doc row (`gap: 8`, bled out with `margin-left: -8/-6`) → journal → tree → bottom group (`gap: 8`).
- Nav item: `min-height: 30px`, `radius 4px`, `font-size: 14px`, `margin-top: 4px`, icon slot 32px
  (44px when collapsible), icon 20px. **Hover and active share one token**,
  `layer/background/hoverOverlay` = `#0000000d` / `#ffffff17`. No border, no accent bar, no colour shift.
- Trick: non-collapsible rows grow to `calc(100% + 16px)` + `translateX(-8px)` on hover/active so the
  highlight bleeds to the panel edge past the 8px container padding (`menu-item/index.css.ts:43-48`).
- Tree node (`navigation-panel/tree/node.css.ts`): `min-height: 30px`, `padding: 0 6px`, `radius 4px`,
  `gap: 12` icon↔label, `margin-top: 2` per row. **Indent per level = 20px** (`node.tsx:260, :516`).
  The chevron swaps in place with the doc icon (both absolute, 20×20, opacity cross-fade on row hover,
  `transform 0.2s`). Trailing actions go `opacity 0→1` _and_ absolute→in-flow so labels truncate right.
- Section header: `height 20`, 12px/500, `text/tertiary`, `padding: 0 8px`, `radius 4`.
- Resize handle (`resize-panel.css.ts:62-110`): invisible **8px** hit area, `cursor: col-resize`,
  `opacity 0→1` with **`transition: opacity 0.15s ease 0.1s`** (100ms delay so it doesn't flicker on a
  sweep). Visible bar 2px / `radius 2px` / `primaryColor`, thickening to 4px while dragging
  (`all 0.2s ease-in-out`). Hidden below 600px.
- **Scrollbars are globally suppressed** (`component/src/theme/global.css:210-232`) and re-enabled only
  inside `editor-host`. The sidebar uses an overlay thumb: `--scrollbar-width: 10px`, `black30`,
  `radius 4`, 44px min hit target, `opacity .15s`; plus a 1px top shadow line inset 16px that fades in
  on scroll (`opacity .3s .2s`).

> **Our "gap too wide / bad framing" complaint:** AFFiNE spends _zero pixels_ on a gap. Delete the gap,
> add a 0.5px hairline, give the content pane a 6px top-left radius, and align 52px headers on both
> sides. Do not tune the gap value — remove it.

## 3. Typography scale

Tokens (`design/packages/theme/src/index.ts:55-67`) → `--affine-font-*`:
`fontTitle 36` (near-unused) · `H1 28` · `H2 26` · `H3 24` · `H4 22` · `H5 20` · `H6 18` ·
`fontBase 15` · `fontSm 14` · `fontXs 12`.
`--affine-line-height: calc(1em + 8px)` — one relative rule (body 15→23, H6 18→26, H1 28→36); only H2
overrides it to `calc(1em + 10px)`.

Real usage across `packages/frontend`: `fontSm` ×194, `fontXs` ×184, `fontBase` ×53, `fontH6` ×17,
`fontH5` ×12, everything else ≤8. **The shell is a 14/12 interface; the document is a 15px surface;
the large sizes exist only inside the editor.**

Doc title (`blocksuite/affine/fragments/doc-title/src/doc-title.ts:21-67`): **40px / 50px / 700**,
`padding: 38px 0` + editor side padding, `max-width: var(--affine-editor-width)`.
Placeholder `'Title'` at `opacity: 0.5`, absolute, `pointer-events: none`.

Headings (`blocksuite/affine/blocks/paragraph/src/styles.ts:30-105`) — size / weight / letter-spacing /
line-height / margin-top / margin-bottom:
`H1 28·700·−0.02em·1em+8·18·10` · `H2 26·600·−0.02em·1em+10·14·10` · `H3 24·600·−0.02em·1em+8·12·10` ·
`H4 22·600·−0.015em·1em+8·12·10` · `H5 20·600·−0.015em·1em+8·12·10` · `H6 18·600·−0.015em·1em+8·12·10`.

- **Paragraphs carry no vertical margin.** Rhythm is entirely `line-height: calc(1em + 8px)` — an
  implicit 8px leading. `--affine-paragraph-space: 8px` is used only as `margin-top` on blockquote
  (`styles.ts:114`) and divider (`blocks/divider/src/styles.ts:12`). That is why it reads dense but
  never cramped: the air lives inside the line box, not between blocks.
- Blockquote: `line-height 26px`, `padding: 10px 0 10px 17px`, 2px bar (`::after`, `radius 18px`,
  `--affine-quote-color`) inset 10px top/bottom.
- Inline code: `calc(var(--affine-font-base) - 3px)` = 12px, `padding: 0 4px 2px`; inside headings it
  scales `base + 10 / +8 / +6 / +4 / +2 / +0`.
- **Block indent per nesting level = 24px** (`blocksuite/affine/shared/src/consts/index.ts:13`,
  applied inline in `paragraph-block.ts:293` and `list-block.ts:162`).
- List prefix: numbered `min-width: 22px; height: 24px; margin-left: 2px`; todo box 24×24 with a 20×20 SVG.
- Stacks: sans `'Inter','Source Sans 3',Poppins…`; serif `'Source Serif 4','Noto Serif'…`;
  mono `'Source Code Pro','IBM Plex Mono'…`. Default Sans; user font-size setting defaults **16**,
  range 12–24 (`modules/editor-setting/schema.ts:29`). Globals: `-webkit-font-smoothing: antialiased`,
  `text-rendering: optimizeLegibility`, `text-autospace: normal`, `font-feature-settings: 'calt' 0` on controls.

## 4. Spacing, radius, border, shadow

**Spacing — 4px base, 4/8/12 spine.** `gap:` tally across `packages/frontend/**/*.css.ts`:
`8`×207, `4`×125, `12`×97, `6`×39, `16`×36, `2`×30, `10`×29, `20`×26, `24`×17.
Single-value `padding:`: `4`×22, `8`×16, `12`×15, `16`×10. → scale **2·4·6·8·10·12·16·20·24**.

**Heights:** `20`×52, `16`×39, `32`×38, `24`×34, `28`×29, `30`×28, `44`×27, `36`×17.
→ **30px list row, 32px icon button, 20/16 icon boxes, 44px menu row, 52px header bar.**

**Radius:** `4`×72, `8`×64, `12`×28, `2`×25, `10`×12, `6`×5, `16`×5, plus `40`/`999` pills.
→ **4 row/inline · 8 popover/menu/button · 12 `--affine-popover-radius` + drag preview · 6 pane corner ·
10 code block · 5 block-selection overlay · 2 micro · 40 pill.**

**Borders: structural separators are `0.5px`, not 1px** (sidebar edge, pane divider, main container,
toolbar, properties divider); interactive outlines are 1px (`focus-visible: 1px solid
layer/insideBorder/primaryBorder`). Values:
`insideBorder/border #e6e6e6 / #414141` · `--affine-border-color rgb(227,226,228) / rgba(46,46,46,1)` ·
`--affine-divider-color rgb(227,226,228) / rgb(114,114,114)` ·
`--affine-hover-color rgba(0,0,0,.04) / rgba(255,255,255,.1)` ·
`hoverOverlay #0000000d / #ffffff17` · `--affine-placeholder-color rgb(192,191,193) / rgb(62,62,63)`.

**Shadows** (`design/packages/theme/src/index.ts:205-240`) — diffuse and near-offsetless:

```
shadow-1  0 0  4px 0 rgba(66,65,73,.14)      shadow-2  0 0 12px 0 rgba(66,65,73,.18)
shadow-3  0 0 20px 0 rgba(66,65,73,.22)      button    0 0 1px 0 rgba(0,0,0,.12), 0 1px 5px 0 rgba(0,0,0,.12)
menu      0 10px 18px rgba(0,0,0,.14), 0 -1px 12px rgba(0,0,0,.08)   ← negative-Y second layer
popover   0 0 30px rgba(75,75,75,.2), 0 0 4px rgba(75,75,75,.3)
overlay   0 1px 6px 0 rgba(0,0,0,.16), 0 8px 14px 0 rgba(0,0,0,.08)
active    0 0 0 2px rgba(30,150,235,.30)     ← focus is a spread shadow, never an outline
cmd       0 10px 80px 0 rgba(0,0,0,.20)      ← command palette only
```

Key surfaces: **menu popover** `min-width 180px`, `radius 8`, `padding 8`, `gap 4`, 14px,
`background: layer/background/overlayPanel`, `box-shadow: menuShadow`; **menu item** `padding 4`,
`radius 4`, `gap 8`, `line-height 22px`; **tooltip** `padding 5px 12px`, `radius 4`, `max-width 280px`;
**code block** `padding 32px 20px`, `radius 10`, bg `#F7F8FA / #1F2022`, 12px mono, collapsed to
`max-height: calc(8 * var(--affine-line-height))` with a gradient fade to the block background.

## 5. Motion

**No motion token layer exists** — every duration is a literal at the call site. Two de-facto defaults:
**`0.2s ease-in-out`** (72 × `0.2s` in `packages/frontend`) and the legacy **`0.23s ease` / 230ms**
(37 × repo-wide). Second tier: `0.3s` for large chrome, `0.15s` for micro-fades, `0.1s` for hover portals.
The three most-used `cubic-bezier`s are literally keyword equivalents
(`(.42,0,.58,1)`=ease-in-out ×9, `(.42,0,1,1)`=ease-in ×7, `(.25,.1,.25,1)`=ease ×3) — **they use keywords.**

| Interaction                                | Value                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Menu item hover bg / sidebar item hover bg | **no transition — instant**                                                                                               |
| Button hover                               | `all .3s` (`ui/button/button.css.ts:41`)                                                                                  |
| Hover-revealed controls                    | `opacity .15s`                                                                                                            |
| Hover popover/portal                       | `opacity 0.1s ease-in-out`, `duration: 100` (`components/src/hover/controller.ts:19-33`)                                  |
| Chevron rotate                             | `transform 0.2s`                                                                                                          |
| **Sidebar open/close**                     | **300ms**, default `ease`, on `margin-left/right` + `transform` + `background` — **not width** (`resize-panel.css.ts:40`) |
| Sidebar while drag-resizing                | transitions **removed** via `data-enable-animation={enable && !resizing}` → 1:1 tracking                                  |
| Resize handle reveal                       | `opacity 0.15s ease 0.1s`                                                                                                 |
| Content reflow beside sidebar              | `all 0.2s ease-in-out`                                                                                                    |
| **Modal overlay**                          | `150ms` fade                                                                                                              |
| **Modal content (desktop)**                | `150ms cubic-bezier(.42,0,.58,1)`, `opacity 0→1` + `translateY(-2%)→0` + `scale(.96)→1`, `forwards`                       |
| Modal exit                                 | same curve, via the **View Transitions API** (`::view-transition-old`)                                                    |
| Mobile sheet                               | `translateY(100%)→0`, `0.23s ease`                                                                                        |
| Command palette / find-in-page             | `120ms cubic-bezier(.42,0,.58,1)`                                                                                         |

No framer-motion anywhere (one comment says so explicitly); orchestration is
`react-transition-state ^2.2.0` + pure CSS keyframes. No springs.
**`prefers-reduced-motion` is honoured in exactly 2 places**, one of which misses the keyframe
animations it was meant to cover — a gap we should not copy.
Bonus: the sidebar "spotlight" (`views/spolight/index.css.ts`) — a
`radial-gradient(64px circle at var(--x) var(--y), textPrimary, transparent)` overlay at `opacity: 0`,
`transition: all 0.2s`, `border-radius: inherit`, pulsed to draw the eye to a freshly-navigated row.

## 6. Block affordances

**Drag handle** (`blocksuite/affine/widgets/drag-handle/src/config.ts`):
`ADD_BLOCK_WIDGET_WIDTH 16` · `CONTAINER_WIDTH 16` (8 top-level) · `CONTAINER_OFFSET_LEFT 2`
(18 for lists/toggles, 5 top-level) · `CONTAINER_PADDING 8` · `GRABBER_WIDTH 4` → `2` hovered ·
`GRABBER_HEIGHT 12` · `GRABBER_BORDER_RADIUS 4` · `DRAG_HOVER_RECT_PADDING 4` · `NOTE_CONTAINER_PADDING 24`.

- Hit area **16×(min 12)px**, `cursor: grab`; visible grabber **4×12px**, `radius 4`,
  `background: var(--affine-placeholder-color)`. **It sits 18px left of the text** (16 + 2), inside the
  96px side padding — that is what the padding is _for_. Toggle lists use 34px.
- Handle height tracks block type (`utils.ts:44-58`): `text 23, h1 40, h2 36, h3 32, h4 32, h5 28, h6 26`.
- Hovering the handle grows its vertical padding to 8px (`padding 0.25s ease`) and **narrows** the
  grabber 4→2px (`width 0.25s ease`) — taller and thinner, a deliberate "grab me".
- **Show/hide is a hard `display` toggle, no fade**; pointer-move throttled at `1000/60` ≈ 16.67ms;
  hover zone extends 24px past the note's right edge.
- Block hover rect on pointer-down: `radius 6px`, `--affine-hover-color`, inflated 4px, and it
  **animates in from `width:0;height:0` via `animation: expand 0.25s forwards`**.
- **"+" button** `18×18`, `radius 4`, `margin-top: 8px`, 12px plus glyph, `color: placeholder →
text-primary`, `background: transparent → hover-color`, `transition: color .2s ease, background .2s ease`;
  positioned flush **16px left of the handle** so the two read as one cluster.

**Block hover / selection.** Paragraph and list containers are `position: relative; radius 4px` and
define **no `:hover` rule at all** — the whole hover affordance is the handle appearing in the gutter;
**blocks never tint on hover.** Selection is a separate overlay `<affine-block-selection>`: absolute,
100%×100%, `z-index 1`, `pointer-events: none`, `background: var(--affine-hover-color)`,
**`border-radius: 5px`**, toggled by `display` with no transition. Marquee
(`.affine-page-dragging-area`) is the same fill with **no radius, no border**.
`@media print { .selected { background: transparent !important } }`.

**Slash menu** (`blocksuite/affine/widgets/slash-menu/src/`):

- Panel **280px wide**, `padding: 8px 4px 8px 8px` (asymmetric for the 4px scrollbar gutter),
  `radius 8`, `background: layer/background/overlayPanel`, `box-shadow: overlayPanelShadow`,
  `z-index 1000`. **`max-height: min(available, 390px)`**. **No open/close transition** (the
  `max-height 0.2s` rule is commented out).
- **Item height 44px**, `padding: 2px 8px`, `gap: 10px` icon↔label, label 14px, sub-label 12px `#8e8d91`.
  Icon is a **28×28 bordered tile** (`padding 4` → 20px glyph, `1px solid --affine-border-color`,
  `radius 4`) — that tile is what makes it read as a catalogue rather than a list.
- Active row is driven by **`@mousemove`, not CSS `:hover`**, so keyboard and pointer share one highlight.
- Group header `padding: 2px 8px`, 12px/500, `text/secondary`, **hidden entirely while searching**.
- Scrollbar 4px thumb, `radius 2`, `scrollbar-gutter: stable`.
- Trigger `/` on `beforeInput`/`compositionEnd` when the text before the caret ends with `/`, open
  debounced 100ms leading. Filtering is **fuzzy** over `[name, ...searchAlias]`, breadth-first over two
  submenu levels, ranked by `substringMatchScore`; a query ending in a space → `no_result`.
- Keys: `↓/Tab/Ctrl+n`, `↑/Shift+Tab/Ctrl+p`, wrapping, then `scrollIntoView({block:'nearest'})`;
  `→` opens submenu, `←` closes, `Esc` aborts. Capture-phase listener.
- Positioned **5px below the caret rect**, flipping above when short of `gap 12 + offsetY 5`; X clamped
  to a 20px viewport edge gap; recomputed throttled at 10ms. Submenus `offset(12)` +
  `autoPlacement(['right-start','right-end'])`. Item tooltips: right side, offset 22, **800ms delay**.

**Inline toolbar** (`blocksuite/affine/widgets/toolbar/`): `height 36px` (content-box),
`padding: 0 6px`, `gap 8`, `radius 8`, **`border: 0.5px solid insideBorder/border`**,
`box-shadow: overlayShadow`, text 14px/500/22px; buttons `radius 4`, `padding 2`, 20px glyph,
hover `--affine-hover-color`. Show/hide is `transition-property: opacity, overlay, display` at
**120ms ease-out** with `transition-behavior: allow-discrete` + `@starting-style` — a real fade, no JS.
Placement `top-start`, **`offset(10)`**, `flip({padding:10})`,
`shift({padding:{top:10,right:10,bottom:150,left:10}})`.

## 7. Empty states and the new-doc page header

A new doc is not a blank page — it is four stacked low-contrast affordances
(`block-suite-editor/lit-adaper.tsx:257-297`):

1. **Icon slot** — with no icon, a `padding: 4px` button with a 16px `icon/secondary` glyph and a 12px
   `text/secondary` label **"Add icon"**; with an icon, a 64×64 / 60px trigger, and the title's 38px
   top padding disappears.
2. **Title** — 40/50/700, placeholder `'Title'` at `opacity 0.5`, absolute, `pointer-events: none`.
3. **Properties table** — shown by default. Header row `height 30`, `padding 4`, `margin-bottom 8`,
   `text/secondary`, 500, then a 0.5px divider. Rows with empty values are hidden via
   `:has([data-property-value][data-empty="true"]) { display: none }`, so a new doc shows a compact
   info strip, not a wall of blank fields.
4. **First-paragraph placeholder** `"Type '/' for commands"` — and **it only renders when the block is
   focused, empty, and the selection is collapsed** (`paragraph-block.ts:155-181`). A doc full of empty
   blocks shows exactly one hint, never a column of ghost text.
5. **Starter bar** — only while `doc.isEmpty$` and not a template. Two pills: `padding: 2px 8px`,
   `radius 40`, `background: layer/background/secondary`, 15/24 label + 20px icon, `gap 4` inside /
   `gap 12` between. Hover is a `::before` overlay of `rgba(0,0,0,.04)` fading `opacity 0→1` over
   `0.2s ease` — not a background swap, so the pill's own tint survives. Same 944px column.
6. Below it, the backlinks panel in the same column, 15/24/500 title.

Chrome stays thin: a 52px bar, `padding: 0 16px` (8px when the sidebar switch shows), background
identical to the page, title centred by an absolute `headerCenter` (`height 52`, `max-width 60%`,
`min-width 300px`), right-side buttons collapsing `max-width: 32 → 0` at `all 0.2s ease-in-out`.
Its bottom hairline appears only once you scroll.

---

## What to steal / what to skip for Campus

**Steal**

1. **Kill the sidebar→content gap entirely**: `0px` gap + `0.5px` hairline + `6px` top-left radius on
   the content pane + 52px headers aligned on both sides. Highest-leverage fix for our framing complaint.
2. **One measure variable**: `--editor-width: 944px` + `--editor-side-padding: 96px`, `border-box`,
   `margin: 0 auto` → 752px measure; full-width mode is a var swap (`100% / 72px`), not a layout branch.
3. **`line-height: calc(1em + 8px)` as the single rhythm rule and zero paragraph margins.** Reserve an
   8px `--paragraph-space` for quotes and dividers only.
4. **Two type registers**: 14/12 chrome, 15 document, 18–28 headings, 40/50/700 title. Chrome never
   borrows document sizes.
5. **Side padding exists to hold the gutter affordance** (handle 18px left of text, "+" another 16px).
   Size our side padding from the affordance, not from taste.
6. **Blocks never tint on hover** — the handle appearing _is_ the hover state. Selection is a separate
   5px-radius overlay layer at `hover-color`.
7. **Focused-only block placeholder.** One hint at a time. Direct CodeMirror win: render the
   `Type '/' …` hint on the cursor line only.
8. **`docEditorGap`** — a `flex-grow: 1`, `padding: 50px 0`, `cursor: text` blank zone that focuses the
   last block on click. Trivial, large perceived-quality gain.
9. **Scroll-reactive header hairline** (`transparent → border`, `0.2s`) and the sidebar's fade-in top
   shadow line (`opacity .3s .2s`).
10. **Delayed resize-handle reveal** (`opacity .15s ease .1s`, invisible 8px hit area, 2px bar → 4px
    while dragging, animation suppressed during drag).
11. **Row highlight that bleeds past container padding** (`calc(100% + 16px)` + `translateX(-8px)`).
12. **Radius ladder 2/4/5/6/8/10/12/40** and **0.5px structural vs 1px interactive borders**.
13. **Diffuse near-offsetless shadows**, a menu shadow with a negative-Y layer, focus as
    `0 0 0 2px rgba(brand,.30)` spread — never an outline.
14. **Slash menu shape**: 280px, 44px rows, 28×28 bordered icon tiles, headers hidden while searching,
    active row driven by mousemove, fuzzy search with alias list, 5px below caret.
15. **Motion budget**: `0.2s ease-in-out` default, `0.15s` fades, `0.3s` panel open/close, `120ms`
    palette and toolbar, `150ms` modal with `scale(.96)→1` + `translateY(-2%)→0`.
16. **No transition on dense list/menu hover backgrounds** — instant on pointer-tracked surfaces.
17. **Hidden scrollbars app-wide, real ones only inside the editor**, with a 10px overlay thumb
    (`black30`, radius 4, 44px min hit area, `opacity .15s`).
18. **Code block treatment** for CodeMirror: `radius 10`, `padding 32px 20px`, tinted bg, 12px mono,
    collapse at 8 lines with a gradient fade.
19. **Empty-doc starter pills** instead of an illustration, with hover as a `::before` opacity fade.

**Skip**

- vanilla-extract + Lit web components — we take numbers into Tailwind `@theme`, not the machinery.
- `@toeverything/theme` as a dependency (MPL-2.0, plus a huge whiteboard palette we'll never use).
- The V1/V2 dual token namespaces (`--affine-*` vs `--affine-v2-*`) — mid-migration debt.
- The dead 36px `fontTitle` token; the real title is a hardcoded 40/50/700.
- Container-query responsive strategy — one 640px breakpoint on the editor column is enough for now.
- Their `prefers-reduced-motion` story (effectively absent). Ship a real global reset instead.
- Noise/blur textures, client-border mode, floating sidebar, split view, edgeless/whiteboard.
- View Transitions API for modal exit — a normal exit animation is fine for our modal count.
- `all .3s` on buttons — too slow; use `0.15s` and keep instant only for dense rows.
