# Campus — Visual reference notes

Research pass against `docs/design.md` ("academic field notebook + quiet operations desk").
Every claim below comes from a screenshot in `docs/research/screenshots/` that was opened and
read, or from the marketing/docs copy of the page.

## Capture conditions (read this before trusting a pixel measurement)

> **Superseded in part — second pass.** The viewport problem described below was fixed by
> abandoning camofox for this job and driving **headless Chromium via Playwright** directly
> (`chromium.launch()` + `newContext({ viewport })`, `deviceScaleFactor: 1`, `isMobile`/`hasTouch`
> on the two small sizes). Headless Chromium needs no display, so nothing touched the Hyprland
> compositor, and it honours `viewport` exactly — all 15 new PNGs are byte-exact 1440×900,
> 768×1024 and 390×844 as reported by `magick identify`. Every desktop observation in sections
> 1–6 still stands; the "nothing validated at 768 or 390" caveat no longer applies — see
> **"Responsive behaviour (captured 390 / 768 / 1440)"** at the end of this file.
>
> One correction carried by the second pass: the ban list at the bottom says "anytype.io and
> tana.inc both hijack the wheel". Anytype is re-confirmed (`documentElement.scrollHeight ===
innerHeight` at all three viewports — 900/1024/844). But **`outliner.tana.inc` does not
> hijack**: it reports scrollHeight 5766 / 4427 / 3839 against those same viewports and scrolls
> natively. The hijack claim applies to `tana.inc` (marketing home), which was not re-captured
> in this pass.

### First pass (camofox / camoufox — kept for the record)

- Captures are **1896×974**, not the requested 1440×900. The camofox browser runs camoufox
  (patched Firefox) with the Playwright context created as `viewport: null`, and
  `POST /tabs/{id}/viewport` fails with a juggler protocol error:
  `Found property "<root>.screenSize" ... which is not described in this scheme`.
  `window.resizeTo()` is a no-op, and the Firefox window is override-redirect on the Xvfb
  display so `xdotool` cannot see it either. This is a **tooling limitation, not a site block** —
  no site refused us, no CAPTCHA was shown.
- Practical consequence: all pages rendered their **widest desktop layout**. Anything below is
  therefore about desktop composition. Nothing here has been validated at 768 or 390.
- One artifact of the harness: the browser window collapses to ~941×452 on the first paint of a
  freshly created tab and settles at 1896×974 a few seconds later. Captures were taken after
  confirming `innerWidth` via `evaluate`.
- Mobbin and PageFlows were **not attempted** — they were outside the assigned URL list.

| File                        | Source                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| `craft-home.png`            | craft.do hero + All Docs app UI                                  |
| `craft-home-product.png`    | craft.do "From first thought to final form" (Todo + doc surface) |
| `craft-docs-calendar.png`   | craft-support.mintlify.app Calendar view                         |
| `craft-blog-tasks.png`      | craft.do/blog/introducing-tasks                                  |
| `tana-daily-notes.png`      | outliner.tana.inc/daily-notes                                    |
| `tana-home.png`             | tana.inc                                                         |
| `things-features.png`       | culturedcode.com/things/features (Mac sidebar + to-do detail)    |
| `things-today-upcoming.png` | Things "Today and This Evening"                                  |
| `anytype-home.png`          | anytype.io hero                                                  |
| `anytype-grid.png`          | anytype.io objects / templates / widgets                         |
| `supernotes-home.png`       | supernotes.app hero + Today view                                 |
| `supernotes-cards.png`      | supernotes.app annotated notecard anatomy                        |

### Second pass (headless Chromium — exact viewports)

Fifteen files, `<product>-<viewport>.png`, all opened and read. None flat: greyscale mean/σ
ranges from 0.82/0.15 (craft-1440) to 0.36/0.35 (tana-390, a dark theme — dark, not black).
All five sites returned HTTP 200 at all three sizes. **No site blocked us, no CAPTCHA, no
consent wall.**

| File                                            | Viewport | Notes                                               |
| ----------------------------------------------- | -------- | --------------------------------------------------- |
| `craft-1440.png` / `-768.png` / `-390.png`      | 3        | www.craft.do home                                   |
| `things-1440.png` / `-768.png` / `-390.png`     | 3        | culturedcode.com/things/features                    |
| `anytype-1440.png` / `-768.png` / `-390.png`    | 3        | anytype.io — scroll-hijacked, initial viewport only |
| `supernotes-1440.png` / `-768.png` / `-390.png` | 3        | supernotes.app home                                 |
| `tana-1440.png` / `-768.png` / `-390.png`       | 3        | outliner.tana.inc/daily-notes                       |

Nothing was scrolled. Every capture is the first viewport as painted, so all measurements below
are either read off the header/hero band or taken from `getComputedStyle` /
`getBoundingClientRect` over the whole document, which does not require scrolling.

---

## 1. Craft

Pages inspected: `craft.do`, `craft-support.mintlify.app/en/plan-and-do/calendar`,
`craft.do/blog/introducing-tasks`.

### Borrow

- **The rule under the document title.** In `craft-home-product.png` the doc "My Sourdough
  Bread" is a bold ~20px title with a **thin full-bleed hairline immediately beneath it**, then
  content. No card, no chrome, no toolbar. That is exactly the `PageHeader` Campus needs:
  `title` + `1px solid var(--rule-soft)` + `margin-bottom: 20px`.
- **Tint the whole document, not the individual blocks.** Craft's sourdough doc is a single
  peach surface with a slightly lighter inner panel; the checklist rows inside it carry no
  background of their own. Campus can use this for Subject detail: give each subject one warm
  tint at the page surface level and keep every row inside it transparent.
- **Metadata as chips embedded in a sentence.** The blog post reads
  `Published on [Nov 28, 2024] in [Building Craft]` where the values are bordered pill chips
  inline in running prose (`craft-blog-tasks.png`). That is far warmer than a key/value table and
  is the right model for `MetadataList` on Subject detail.
- **Inline tag pill trailing the task title, not leading it.** Craft's Todo rows are
  `☐ Perfect Bread Recipe  [Cooking]` — checkbox, title, then a small low-contrast grey pill
  right after the text baseline. No column, no right-alignment. Cheap to build, reads as prose.
- **The three-column docs shell.** `craft-docs-calendar.png` shows nav ~300px / content ~680px /
  "On this page" rail ~290px. This validates design.md's 220 / 760–900 / 260 split at
  desktop width, and shows the right rail can be pure text links with zero borders.
- **Active nav item = accent-colored text only.** In the Mintlify sidebar, "Calendar" is the
  active item and is rendered in blue text with **no pill, no fill, no left bar**. Section
  headers get an icon; leaf items do not.
- **Docs copy discipline.** The Calendar page is three nouns and one line each:
  "Daily Notes — Your document for capturing thoughts or plans for the day / Tasks — All tasks
  with a scheduled date will appear here / Events — ... shown in a list format." Campus empty
  states and onboarding should be written at this length.

### Do NOT borrow

- **The collage/paper-cutout marketing aesthetic** (`craft-home.png`: sky blue gradient, torn
  paper mountains, clouds). It is a landing-page device. Dropping it into the app would make
  Campus read "juvenile school aesthetic" — explicitly on design.md's avoid list.
- **The colored-card doc grid.** Craft's All Docs view uses saturated cards (pink/yellow/green)
  each with a border in its own tint. At 8+ cards it becomes visual noise with no information
  ranking. Campus's Courses/Library must not become a color-block grid.
- **Craft's floating rounded nav bar** (a pill that hovers over content with a shadow). It is
  chrome-heavy; design.md asks for low chrome.
- **The Craft display serif in the UI.** Craft uses a high-contrast transitional serif at 56px+.
  Great for a hero, wrong for a product surface. Campus's serif is a spot treatment, not a
  headline system.
- **The Mintlify docs frame itself** — the top tab strip (Getting Started / Features /
  Integrations / Craft in Action / Account) plus a left nav plus a right ToC is three
  simultaneous navigations. Campus has one.

### Relevance to Campus

- **Subject detail** — the title-plus-hairline header, the tinted document surface, and the
  inline-chip metadata line map 1:1 onto `PageHeader` + `MetadataList`.
- **Calendar** — Craft's Calendar view is "daily note + scheduled tasks + synced events in one
  day column, each toggleable". That is precisely the agenda-first model design.md §11 wants,
  and it confirms events should be a _list_, not a grid.
- **Plan / Courses** — Craft's doc grid is the counter-example: it tells Campus to render
  subjects as rows with a status glyph, and reserve cards for the few pinned/in-progress ones.
- **Onboarding** — the docs' numbered-step blocks (1..7, one imperative sentence each) are the
  register for the 5-step university → facultad → carrera → plan → confirmar flow.

---

## 2. Tana Outliner (`outliner.tana.inc/daily-notes`)

### Borrow

- **Relative day naming as the page title.** The daily page title is literally
  **"Yesterday, Mon, Jun 26"** — relative label first, then weekday, then date
  (`tana-daily-notes.png`). Campus's Today should do the same in Spanish:
  `Hoy · viernes, 14 de agosto`, and `Mañana · sábado, 15 de agosto` when you page forward.
- **A plain-text day navigation strip under the title.** `Previous day  Next day  Go to date
**Today**  |  Switch calendars ⌄` — no buttons, no icons, just text links with **"Today"
  emphasized as the anchor**. This is the cheapest, quietest day-stepper possible and it is
  exactly the "quiet operations desk" register.
- **Breadcrumb above the title, not beside it.** `FT 2023 › 2023 › Week 26` at ~11px muted.
  Campus: `Ingeniería en Sistemas › 3° año › Diseño de Sistemas`.
- **The "+ label" ghost slot.** Tana renders unfilled structural slots as faint `+ Year
at-a-glance` / `+ Day date` text. This is a great pattern for Campus's Subject detail: show
  `+ Agregar recurso`, `+ Agregar nota` as ghost text in the flow rather than a toolbar of
  buttons. It makes the page's _shape_ legible even when empty.
- **Right-aligned reference counts in a small boxed number.** Each outline row ends with a
  boxed `2`, `1`, `+7`. Campus can use this for "cuántas entregas / cuántos recursos" on
  `SubjectRow` without adding a column header.
- **Label/value split inside the outline.** Left column carries the template field name
  ("Daily framework", "Weekly Growth meeting"), right column the content. Campus's Subject
  detail (`requires` / `unlocks` / `estado`) should use the same two-column-inside-a-row shape.
- **Copy thesis.** "Every day starts with a clean canvas" / "the app always has a natural place
  to start your day". That is the argument for Today being the default route, and it is worth
  putting in the PRD.

### Do NOT borrow

- **The dark purple gradient shell and the Unsplash banner slot.** Campus is warm-paper light
  first. The banner in particular pulls the page toward "blog" and away from "notebook".
- **The `#supertag` chip everywhere.** Tana's outline has 4–6 colored `#tag` chips visible per
  screen. For students that is unearned syntax. Campus's equivalent is the subject name, which
  is already a stable noun — do not invent a tag system for the POC.
- **The infinite outline with bullets, collapse arrows, and drag handles on every row.** It is
  the reason Tana feels like a power tool. Campus's Today must have exactly one interaction per
  row (open it) and one affordance (complete it).
- **Nested "Helps us think outside of box..." helper text under every node.** Persistent inline
  help is clutter; Campus should teach with empty states, not annotations.

### Relevance to Campus

- **Today** — the title/breadcrumb/day-strip stack is a directly implementable header for the
  Today screen. Adopt the relative-day title and the text-link day stepper.
- **Calendar** — "Go to date / Today / Switch calendars" is the minimum viable calendar control
  set. Campus needs no more than this in the POC.
- **Subject detail** — the label/value outline and the `+ ghost slot` pattern.
- **Quick Capture** — Tana's thesis ("use the daily page as a place to save things for later")
  argues Campus's Cmd+K default destination should be _today_, not an inbox the student then
  has to triage.

---

## 3. tana.inc (note: this is now a different product)

**Finding worth flagging to the team:** `tana.inc` no longer markets the outliner. It is now
"an agentic meeting platform where AI agents do real work during native video calls", and the
outliner has been moved to `outliner.tana.inc`. `design.md` §1 lists `tana.inc` as inspiration
for "today as entry point, capture first" — that link is stale and should be repointed to
`outliner.tana.inc`.

### Borrow

- **The palette is startlingly close to Campus's own.** `tana-home.png` is a warm cream
  (~`#faf7f3`) washing to a peach/clay at the edges — effectively `--paper: #f7f5ef` with a warm
  gradient. It is proof the warm-paper direction reads as _serious software_, not as
  "scrapbook", when the type is disciplined.
- **Serif italic as the emphasis mechanism inside a sans headline.** "Do work _in_ the meeting"
  — the entire line is a grotesk except the one italic serif word carrying the argument. This is
  the single best answer to design.md §3's "use serif selectively": Campus can set
  `Hoy tenés *3 cosas* que importan` with the number in Newsreader italic and everything else in
  Inter. One serif word, not a serif heading.
- **Section headers as a two-line serif couplet.** "An Agentic Meeting Platform / That turns
  meetings into the most productive part of your day" — title line + subordinate line, both
  serif, second line lighter. Good `SectionHeading` model for Plan and Courses.
- **One black pill CTA, nothing else.** The entire above-the-fold has exactly one action.

### Do NOT borrow

- **The AI-agent framing and the floating chat-bubble product shot.** design.md explicitly
  bans the "AI sparkle aesthetic". Campus is a system of record for a degree plan, and students
  distrust apps that lead with agents.
- **Full-viewport pinned hero with scroll-jacking.** The page intercepts wheel events —
  `window.scrollTo` does nothing and `document.body.scrollHeight` equals the viewport. It broke
  our scroll and it breaks keyboard users. Never ship this.
- **Dark drop-shadowed floating labels** over a light surface — high contrast, low information.

### Relevance to Campus

- **All screens, typography** — this is the strongest evidence for the "one serif italic word"
  rule. Put it in the type scale, not in a component.
- **Onboarding** — the single-CTA hero is the register for each of the five onboarding steps:
  one question, one primary action, nothing else on screen.

---

## 4. Things (`culturedcode.com/things/features/`)

The highest-yield reference of the eight. Two screenshots, both worth reading closely.

### Borrow

- **Row-vs-card is decided by _source_, not by importance.** In `things-today-upcoming.png`,
  calendar events are grouped into **one** grey rounded block (radius ~8, no internal
  separators, no per-event borders), and to-dos below are **bare rows with no surface at all**.
  Campus should do the same: class schedule (immovable, externally-sourced) sits in a single
  `--paper-elevated` block; deadlines and personal tasks (yours, actionable) are bare rows on
  the paper.
- **Time as a coloured left column inside the event block.** `07:00` blue, `08:30` blue, `11:00`
  green, `15:30` green — the colour encodes the source calendar, the alignment does the reading.
  Campus: tabular-figure time column, colour keyed to subject, `font-variant-numeric:
tabular-nums` so 09:00 and 18:00 align.
- **All-day items get a small vertical colour bar where the time would be.** "▌Marc's birthday"
  sits above the timed rows in the same block. Campus's "Parcial de Estadística" (a day, not a
  time) uses exactly this.
- **Two-line to-do row: title 13px ink / project 11px muted, no separator between rows.** Rows
  are held apart by ~10px of rhythm alone. This is the single most important density lesson —
  Things gets ~7 items into 250px with zero rules and zero cards.
- **Deadline flag right-aligned, red, tiny, and only when it exists.** `🚩 today` in
  `--danger` at the right edge of the row. Absence is the default state; presence is the signal.
- **Selected sidebar row = soft grey rounded-rect fill.** I want to correct a common
  mis-citation here: Things does **not** use a left accent rule for the active row. In
  `things-features.png` the selected item "Prepare Presentation" is a `#e8e8e8`-ish rounded
  rectangle behind the full row. The _accent_ is spent elsewhere — on the section headings.
- **Sidebar counts right-aligned, and only where non-zero.** `Inbox 2`, `Today [1] 8` — the red
  badge is the overdue count, the plain grey number is the total. Two numbers, two weights, no
  legend needed.
- **Sidebar groups separated by whitespace, never by dividers.** `[Inbox] / [Today, Upcoming,
Anytime, Someday] / [Logbook] / [Family] [Work] [Hobbies]` — six groups, zero `<hr>`.
- **Section headings inside content = small bold accent-coloured label with a hairline running
  to the right edge, and a `···` sitting on the end of that rule.** ("Slides and notes",
  "Preparation", "Facilities".) This is the `SectionHeading` Campus should build: label + rule +
  optional trailing affordance, all on one 20px band.
- **Inline detail chips appear only when set.** A date chip `Nov 13` (grey, rounded, tabular),
  a tag chip `Important` (outlined pill), a `★`. design.md's own line "those fields are neatly
  tucked away in the corner until you need them" is Cultured Code's stated principle — steal it
  verbatim as a rule.
- **Segmented filter row as ghost chips.** `All | Important | Diane | ···` where only the
  selected one has a fill. Perfect for Plan's year filter (`1° · 2° · 3° · Todos`).

### Do NOT borrow

- **Emoji-style coloured glyph icons** (yellow star for Today, blue calendar for Upcoming, green
  stack for Someday). They are macOS-native charm and would read as toy in a browser. design.md
  says Lucide only — hold that line, and carry the meaning in the label.
- **"This Evening" as a structural concept.** It is a lifestyle affordance. The academic
  equivalent is not "tonight", it is _deadline proximity_. Do not invent a Campus analogue.
- **The grey `#e5e7eb`-ish app chrome.** Things' window background is a cool neutral grey.
  Campus's `--paper: #f7f5ef` is warm; do not let a cool grey creep in as the "elevated"
  surface — `--paper-elevated: #fffefa` must stay warm.
- **Five containers (Inbox / Today / Upcoming / Anytime / Someday).** GTD taxonomy is a system
  the student must learn and maintain. design.md §18's failure mode is literally "I have another
  productivity system to maintain". Campus has Today / Plan / Courses / Calendar and those are
  derived from the degree plan, not curated by hand.
- **Drag-and-drop-to-reschedule as the primary reschedule affordance.** It is undiscoverable and
  it is not testable in a POC.

### Relevance to Campus

- **Today** — this is the blueprint. `DaySection` = grouped events block on top, bare
  `DeadlineRow`s below, right-aligned danger flag, no cards anywhere.
- **Plan** — the sidebar's whitespace-separated groups and right-aligned counts are exactly what
  `1° AÑO / 2° AÑO / 3° AÑO` with `28 / 39 materias` needs.
- **Courses** — the selected-row grey fill and the `SectionHeading` (label + rule + `···`) are
  the two components to standardize first.
- **Calendar** — grouped-events-block-per-day is the agenda cell.

---

## 5. Anytype (`anytype.io`)

### Borrow

- **The hairline grid instead of cards.** `anytype-home.png` divides the page into cells with
  **1px solid rules, zero border-radius, zero shadow, zero fill**. The three value props sit in
  three cells of one ruled table. This is the definitive "avoid card-everything UI" answer from
  design.md §5, and it looks like ruled paper — which is Campus's exact metaphor. Implement as a
  CSS grid with `border-inline-start: 1px solid var(--rule)` on cells and `border-block-start` on
  the row, so no double borders.
- **Two type registers colliding inside one headline.** "A safe haven" in a geometric sans,
  "for digital collaboration" in a serif, and only the serif half is coloured. Same lesson as
  tana.inc, different execution — confirms the pattern.
- **Objects are a glyph + a noun, and that pair is the whole vocabulary.** `anytype-grid.png`
  shows `✅ Task  🧑 Person  📄 Page  🎯 Goal  📇 Contact  📁 File  🏢 Company  💡 Idea
🔖 Bookmark  📹 Video` as identical pills. Campus's object set is small and should be
  presented the same way: `Materia · Entrega · Parcial · Recurso · Nota`. One glyph, one noun,
  one pill shape for all of them.
- **Relation values stack under the title in a fixed order, muted then coloured.** The database
  cards read: `☐ title (wraps to 3 lines) / Today (muted) / [Work] (coloured chip)`. Date first
  in muted grey, category second as a chip. Campus's `SubjectCard` should use the same order:
  title → next deadline (muted) → status chip.
- **A widget is a title, a sort control, then rows.** The "Computer pioneers / Last added ⌄"
  block puts the sort affordance immediately under the title as quiet text with a chevron, not
  in a toolbar. Ideal for the 260px `ContextRail`.
- **1-bit pixel-art line illustration.** If Campus ever needs an illustration (empty Library,
  onboarding confirmation), a monoline 1-bit drawing is the only style consistent with
  "no mascot" that is still warm.

### Do NOT borrow

- **The graph view** — design.md already rules it out for the POC, and Anytype's own site shows
  why: it is beautiful and answers no question a student has.
- **Pure black `#000` backgrounds with `#fff` hairlines.** The dark section of anytype.io is
  striking and completely incompatible with a warm paper theme. If Campus ever ships dark mode,
  it should be warm ink (`#181816` family), never true black.
- **Scroll-jacked section transitions** (same failure as tana.inc — `document.body.scrollHeight`
  equals the viewport; only synthesized wheel events move the page).
- **The floating `WHAT / WHY / WHO` pill nav pinned to the bottom.** It duplicates the page's own
  structure and steals the space Campus reserves for mobile bottom nav.
- **Emoji as the object glyph.** Anytype gets away with it because users pick their own. Campus
  should use Lucide monochrome glyphs so `Materia` and `Entrega` are visually siblings.

### Relevance to Campus

- **Library / Courses** — the hairline grid is the layout. A ruled table of subjects beats a
  grid of cards and directly serves the notebook metaphor.
- **Plan** — object+relation is the mental model behind `requires` / `unlocks`; the
  title→date→chip stacking order is the row template.
- **Context rail** — the "title + sort chevron + rows" widget.
- **Empty states** — the 1-bit monoline illustration is the one illustration style that does not
  violate "no mascot".

---

## 6. Supernotes (`supernotes.app`)

### Borrow

- **The stacked date badge.** A small rounded square with the weekday abbreviation over the day
  number (`Tue` / `22`), tinted, sitting immediately above the "Today" title
  (`supernotes-home.png`). It gives the date object-status without a heading. This is the best
  single element to lift for Campus's Today header.
- **Greeting line, then a count, then content.** `Today` → "Good afternoon Tobias. Here's
  everything from Today, 22nd November" → `7 Cards` (small, muted). design.md §7 already drafts
  "Buen día. / You have 3 things that matter today." — Supernotes proves the three-tier stack
  (title / greeting sentence / count) reads well and does not feel like a dashboard.
- **Quick capture as an always-present inline field directly under the header.** "Start typing /
  paste anything to create a new card…" — full-width, low-contrast placeholder, no button, no
  modal. Campus should have this on Today _in addition to_ Cmd+K, because on mobile the sheet is
  a second-class path and this is a first-class one.
- **The notecard anatomy** (annotated in `supernotes-cards.png`): title (bold ~15px) → parent
  chip (tiny coloured glyph + coloured label, e.g. `⚡ Electrical Engineering`) → body with inline
  underlined links and yellow highlight → footer row with reactions on the left and `#tags` on
  the right. Campus's `SubjectCard` maps exactly: title → carrera/año chip → next deadline →
  footer with status and a `···`.
- **Their own examples are academic.** The annotated card is literally "Transistor / Electrical
  Engineering / a semiconductor device used to amplify or switch electronic signals". The
  logo wall is Harvard, CERN, Oxford, MIT, Cambridge. Supernotes is the closest of the eight to
  Campus's audience, and its restraint (no gradients in-app, one accent) is the proof that
  academic ≠ dull.
- **Sidebar mini-month where days with content get a soft filled pill and today gets a solid
  one.** Two states, one colour, no legend. Right density for Campus's `ContextRail` on Plan and
  Calendar.
- **Section counts right-aligned in the sidebar** (`Home 3258`, `Thoughts 9`, `Tasks 46`) — same
  lesson as Things, independently arrived at. Treat this as settled.
- **A collapsed "Outline" section at the bottom of the sidebar** with row + count
  (`Calls & Catchups 30`). Good home for Campus's `Materias en curso`.

### Do NOT borrow

- **The masonry card wall as the primary content view.** Ragged bottoms, no scan line, no
  ranking. Campus's Today must be a single vertical list.
- **The hot pink accent (`#f7647c`-ish) and the green-white gradient hero.** design.md's accent
  is `#3157d5`. One accent, and it is blue.
- **The dog mascot.** design.md §13: "No mascot." Non-negotiable.
- **Reaction counts (`❤️13  💬21  👥15`) in the card footer.** Social metrics on an academic
  object are noise; a student has one reader. Reuse that footer band for status + deadline
  instead.
- **The chunky slab-ish display serif at 64px** ("Free your thoughts", "Introducing the
  notecard"). Heavier than Newsreader/Source Serif 4 and it tips toward "brand" over "notebook".
- **Emoji category glyphs** (`🍴 Restaurants`, `🍦 Gelaterias`) — same objection as Anytype.

### Relevance to Campus

- **Today** — the stacked date badge, the greeting-then-count header, and the inline capture
  field are three ready-to-build pieces of the Today hero.
- **Library** — the notecard anatomy is `ResourceRow` / note card.
- **Courses** — title + parent chip is the `SubjectRow` header treatment.
- **Calendar / context rail** — the mini-month with two day states.

---

## Synthesis — 10 rules for the Campus UI

These are written to be implemented, not admired.

### R1. Two families, and the serif is a word — never a heading

Inter (or Instrument Sans) for 100% of UI. Newsreader/Source Serif 4 appears **only** as
italic emphasis on 1–3 words inside an otherwise sans line, and on the Today date. Precedent:
tana.inc ("Do work _in_ the meeting") and anytype.io ("A safe haven / _for digital
collaboration_").

```
Today title:   Inter 600 / 28px / -0.02em      "viernes, 14 de agosto"
Emphasis:      Newsreader italic 400 / same size, inherits colour
Section label: Inter 600 / 12px / 0.06em / uppercase / var(--ink-muted)
Row title:     Inter 500 / 14px / 1.4
Row meta:      Inter 400 / 12px / var(--ink-muted)
Numerals:      font-variant-numeric: tabular-nums  (mandatory on all times, counts, dates)
```

Never set a serif above 32px. Never set a serif in a row.

### R2. Three surfaces exist. There is no fourth.

1. `--paper` (`#f7f5ef`) — the page. Rows live directly on it with no background.
2. `--paper-elevated` (`#fffefa`) + `1px solid var(--rule-soft)` + `radius 12px` — used **only**
   for externally-sourced, non-actionable groups (the day's class schedule, a synced event
   block). Precedent: Things groups all calendar events into one block and leaves to-dos bare.
3. `--accent-soft` (`#e7ecfb`) — selection and today-marker only.

No shadows anywhere except a 2px sheet/dialog lift. If a thing needs to be distinguished, use a
1px `--rule-soft` line, not elevation.

### R3. Rows are the default. A card must earn itself.

Use a **row** for: deadlines, classes, subjects in Plan, resources, search results, anything in
a list of more than three. Use a **card** for: a pinned/in-progress subject on Courses, and the
Subject detail page itself. That is the entire card budget.

Test: if the container is repeated more than 4 times on one screen, it is a row.

Anti-precedent: Craft's colored All Docs grid and Supernotes' masonry wall both lose scannability
at ~8 items.

### R4. Rows are separated by rhythm, not by rules

```css
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  padding: 10px 0;
  min-height: 44px;
  align-items: baseline;
}
.row + .row {
  border-top: 0;
} /* no separators between siblings */
.row:hover {
  background: var(--rule-soft);
  border-radius: 8px;
  margin-inline: -8px;
  padding-inline: 8px;
}
```

Hairlines are reserved for **section boundaries only** (R6) and for the Library/Courses grid
(R9). 44px min-height satisfies the tap target in the responsive matrix at 360px.

### R5. "Today" is framed by a date object, a sentence, and a count — never by a KPI

The Today header is exactly four lines, in this order:

1. Stacked date badge — rounded square 40×40, `--accent-soft`, weekday abbreviation 10px over day
   number 18px semibold. _(Supernotes)_
2. Relative-day title — `Hoy` in serif italic, then `· viernes, 14 de agosto` in sans.
   Paging forward changes it to `Mañana ·`, `Lunes ·`. _(Tana)_
3. Greeting sentence, one line, plain: `Buen día. Tenés 3 cosas que importan hoy.`
4. Day stepper as plain text links: `← Día anterior · Ir a fecha · **Hoy** · Día siguiente →`,
   with `Hoy` semibold. No buttons. _(Tana)_

Then a `1px solid var(--rule-soft)` and content. No numbers in boxes, no progress rings, no tiles.

### R6. `SectionHeading` = 12px uppercase label + hairline to the right edge + optional trailing affordance

```
HOY ────────────────────────────────────────────────────── ···
```

The label is `--ink-muted`; the rule is `--rule-soft` and starts 12px after the label and runs to
the content edge; the trailing `···` (Lucide `more-horizontal`) sits on the rule and is
`opacity:0` until `:hover`/`:focus-visible` on the section. Precedent: Things' "Slides and notes"
/ "Preparation" headings. Sections are separated from each other by 28px of space and **no**
divider.

### R7. Metadata appears only when it exists, always trailing, always small

- Date chip: `Nov 13` → `13 nov` — `--rule-soft` background, 11px tabular, radius 6px.
- Status chip: outlined pill, 11px, `1px solid currentColor`, colour from
  `--success/--warning/--danger`, **always accompanied by its glyph** (design.md §9: colour is
  never the only carrier — `✓ Aprobada`, `● Cursando`, `○ Disponible`, `◌ Pendiente`,
  `🔒 Bloqueada`, using Lucide `check`/`circle-dot`/`circle`/`circle-dashed`/`lock`).
- Deadline flag: right-aligned, `--danger`, 11px, rendered **only** when due today or overdue.

An empty metadata slot renders nothing at all — no dash, no placeholder, no reserved column.
Cultured Code's own words: fields are "neatly tucked away in the corner until you need them".

### R8. Selection is a filled rounded rect. Navigation-active is coloured text.

- Selected row in a list (Courses, Plan, search): `background: var(--rule-soft);
border-radius: 8px`. Full-row fill, no left bar. _(Things — verified in `things-features.png`,
  contra the common claim that Things uses a left accent rule.)_
- Active item in the left nav: `color: var(--accent)` and `font-weight: 500`. **No fill, no bar,
  no pill.** _(Craft docs sidebar.)_
- Today's date in any calendar: `--accent-soft` filled circle; days that have content get the
  same circle at 40% opacity. Two states, no legend. _(Supernotes mini-month.)_

Sidebar groups are separated by 20px of whitespace and never by an `<hr>`.

### R9. Courses and Library are a ruled grid — 1px lines, no radius, no fill, no shadow

```css
.ruled {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.ruled > * {
  border-inline-start: 1px solid var(--rule);
  border-block-start: 1px solid var(--rule);
  padding: 20px;
}
/* draw the outer frame on the container, not on the cells, to avoid doubling */
```

This is Anytype's treatment and it is the most literal expression of "ruled notebook paper" of
anything researched. It also fails gracefully: at 360px it collapses to a single column of
stacked rules.

### R10. Empty states are one sentence and one verb, in Rioplatense Spanish, with no illustration

Structure: a `--ink-muted` sentence at 14px, then a single ghost `+ Verbo sustantivo` link in
`--accent` — the same "+ label" ghost-slot device Tana uses for unfilled structure, so an empty
screen still shows its own shape.

```
Today (empty):    No tenés nada para hoy. Buen momento para adelantar algo,
                  o para no hacer nada.
                  + Anotar algo para hoy

Library (empty):  Todavía no guardaste ningún recurso.
                  + Agregar un recurso

Courses (empty):  Elegí tu plan de estudios y las materias aparecen solas.
                  + Configurar plan
```

No mascot, no illustration (the one exception permitted is a 1-bit monoline drawing, Anytype
style), no exclamation marks, no "¡Ups!". Every string in `vos`, never `tú`.

---

### Two cross-cutting bans, restated because four of the eight sites violate them

- **No scroll-jacking.** anytype.io and tana.inc both hijack the wheel; on both,
  `document.body.scrollHeight === innerHeight` and `window.scrollTo()` is inert. It broke
  automated capture and it breaks keyboard and screen-reader navigation.
- **No emoji as a semantic glyph.** Things, Anytype and Supernotes all lean on emoji for object
  type. Lucide monochrome only (design.md §15) — it keeps `Materia` and `Entrega` visually
  siblings and it survives the light/dark and the Windows/Linux font situation.

---

## Responsive behaviour (captured 390 / 768 / 1440)

Second pass, headless Chromium, exact viewports. Every number here was measured with
`getBoundingClientRect` / `getComputedStyle` in the live page, not eyeballed off a PNG; the PNGs
are the corroboration. **Nothing has horizontal overflow** — `documentElement.scrollWidth ===
innerWidth` on all five sites at all three sizes. Whatever else these teams got wrong, none of
them shipped a sideways-scrolling phone page.

The five products split cleanly into two philosophies, and the split is the single most useful
thing this pass found:

- **Frozen type, fluid measure** — Things and Tana. Type sizes are _identical_ at 390, 768 and 1440. Only the text column width changes. Nothing is scaled down; things wrap instead.
- **Fluid type, fluid measure** — Craft, Supernotes, Anytype(partly). The display sizes shrink
  25–35 % from 1440 to 390.

Both work. The frozen-type products are noticeably more readable at 390 and noticeably less
impressive at 1440. For a study tool that will be read on a phone in a hallway, frozen type is
the better bet.

### 1. Craft (`www.craft.do`)

**Navigation.** A floating rounded pill bar, `position: fixed`, 52px tall at every viewport.
It degrades in two stages, not one:

| Viewport | Header box     | Top-level links                                           | CTA         |
| -------- | -------------- | --------------------------------------------------------- | ----------- |
| 1440     | 920×52 @ x=260 | 6 — Product, Imagine, Community, Pricing, Learn, Download | 133×36 pill |
| 768      | 672×52 @ x=48  | 4 — **Imagine and Learn silently dropped**                | 133×36 pill |
| 390      | 342×52 @ x=24  | 0 — wordmark + CTA + hamburger only                       | 113×36 pill |

The 768 step is the interesting one: instead of going straight to a burger, Craft _edits the
menu_ — it keeps a real horizontal nav by deleting the two least important items. Two of six
links are simply not reachable at 768 without going somewhere else.

**Density.** The desktop nav links are **21–22px tall** — a mouse-only target. Inside the 390
drawer the same items are re-rendered as **310×46 rows with a 16px radius**, i.e. Craft ships a
completely separate touch component rather than restyling the desktop one. Side gutter goes
36 → 51 → 24px (`h1` x-offset), so the phone gutter is _narrower_ than the tablet one.

**Type scale.** `h1` 66 → 58 → **48px**, `line-height: 1.0` at all three (66/66, 58/58, 48/48).
Body copy is frozen at **16px/24px** everywhere. So Craft shrinks display type by 27 % and never
touches body type.

**Rows vs cards.** Fixed-track grids that change _count_, not track size:
`repeat(4, 240px) gap 8px` → `repeat(2, 240px)` → `repeat(1, 240px)`. A 240px card stays a 240px
card and the grid just gets narrower. Its two-column 440px content grid holds at 768
(`2 × 280px`) and only collapses at 390 (`1 × 358px`). The 6-up logo strip does the opposite and
squeezes its tracks — `6 × 160px` → `5 × 105px` → `4 × 65.5px` — which is how you get
unreadable logos.

**Do NOT copy.** Dropping nav items at 768 with no overflow affordance. Also: at 390 Craft keeps
several oversized decorative images bleeding off-canvas at negative x (`965×941 @ x=-179`,
`742×508 @ x=-46`), which is fine for a landing page and pure download weight for an app.

**Also worth stealing.** At 390 the hero product shot is swapped for a **different asset** — a
phone mockup (`310×642`), not a scaled-down desktop window. That is the correct answer to
"our screenshot is illegible on mobile".

### 2. Things (`culturedcode.com/things/features/`)

**Navigation.** There is **no hamburger at any viewport, and no `<header>` or `<nav>` element at
all** (the probe found zero). Three text links — Features, Support, Blog — right-aligned,
**28px tall with a 6px radius**, at 1440, 768 _and_ 390. Wordmark 100×32. The only concession to
390 is that the links shrink from 73 → 68px wide (font 16.2 → ~15px) and the wordmark's left
inset goes 264 → 25 → 10px. A three-item nav simply does not need to collapse.

**Type scale.** Completely frozen: `h1` **36px/36px, weight 700**; `h2` 36px; `h3`
16.2px/22.68px; lede `p` **20.25px/26.325px**; `body` 18px/25.2px. Identical at all three
viewports. The `h1` measure goes 440 → 440 → 305px and the headline just re-wraps from 2 lines
(72px tall) to 3 lines (108px tall).

**Rows vs cards.** The whole page is one grid repeated ~20 times: `2 × 441px, gap 18px` at 1440
— **and the same `2 × 344px` at 768** — collapsing to `1 × 359px` only at 390. So Things's real
breakpoint sits somewhere between 768 and 390, not at 768. Content column: 900 → 707 → 359px.

**Density.** Unchanged. The 18px gap and 20.25px lede are the same on a phone as on a desktop;
Things buys mobile readability with wrapping, not with tightening.

**Do NOT copy.** The feature imagery. `1000×1000` at 1440 → `785×785` at 768 → **`399×399` at
390**, and those images are screenshots of app windows containing 11px UI text. At 390 the Mac
window mock and the iPhone mock are side by side inside 359px and both are pure grey mush —
verified in `things-390.png`. A screenshot of a UI is not a responsive image.

### 3. Anytype (`anytype.io`)

**Navigation.** Header 1440×**80px** at desktop, 390×**60px** at both small sizes. Contents are
identical at all three — wordmark, a `Download` pill that is **117×36 at every viewport**, and a
burger — except the centred announcement strip ("Run your company on Anytype · Encrypted,
Swiss-based, yours", 433×20) which survives at 768 and is dropped at 390.

**Density.** Bad numbers here. The burger is a **32×80 hit area** and at 768/390 its box starts
at `y = -10`, i.e. clipped above the viewport; effective width 32px, well under 44. The
`Download` anchor's text link is **66×17**. Body copy 18px/26px at 1440 and 768, dropping to
16px/24px at 390.

**Rows vs cards — the one genuinely good pattern.** The 4-up ruled band under the hero
(`4 × 351.5px`, 1px rules, no fill, no radius, no shadow) degrades exactly as hoped:
**4 columns → 2 columns at 768 → a single stacked column of ruled cells at 390**, each cell
full-bleed to the 390px edge with the rule as the only separator. At 390 the entire page is down
to **one** grid container; everything else has become `flex-direction: column` (flex-column count
goes 6 → 8 while flex-row drops 62 → 52). This validates note R9: a ruled grid is the layout that
survives 390px without a redesign.

**Do NOT copy — two hard failures, both measured.**

1. **The scroll hijack is total, including on touch.** `documentElement.scrollHeight ===
innerHeight` at 1440 (900), 768 (1024) _and_ 390 (844). There is no scrollable document; the
   page is a fixed-height canvas moved by JS. On a phone this means no momentum scroll, no
   scroll-to-top gesture, no find-in-page.
2. **A fixed bottom pill that eats the content.** The `WHAT / WHY / WHO` segmented control is
   `position: fixed, z-index: 10`, **308×56 sitting 32px off the bottom at 1440** — and
   **236×52 sitting only 10px off the bottom at 390**. At 390 it covers the "Offline & Online"
   heading and a line of its body copy (visible in `anytype-390.png`), and
   `elementsFromPoint(195, 784)` returns the pill's own link, not the text — so it intercepts the
   tap too. A floating overlay tuned for a 900px-tall desktop becomes an occluding blocker on an
   844px phone.

### 4. Supernotes (`supernotes.app`)

**Navigation.** The most aggressive collapse of the five, and it happens **at 768, not at 390**.

| Viewport | Header contents                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440     | Wordmark 137×62 + 7 links (What's New, Features, Pricing, Download, Integrations, Blog, Community), each **40px tall** + `Log in` 83×62 + `Sign up` pill |
| 768      | Wordmark 240×91 + **one circular hamburger (~56px)**. Zero visible links.                                                                                |
| 390      | Wordmark 187×65 + **one circular hamburger (~50px)**. Zero visible links.                                                                                |

Everything — including both auth actions — goes behind a single round button. The circle is the
only nav affordance on the page at 768 and below.

**Type scale.** Genuinely fluid: `h1` **90 → 80 → 60px** (lh 1.0), `h2` 52.8 → 43.2 → 38.4px,
`h3` 38 → 32 → 32px. The lede holds at 20px/32px across all three. But a 15px/22px caption at
1440 becomes **13px/22px at 390** — under 16px, which is the size at which iOS Safari zooms on
focus and the size at which small print stops being read at arm's length.

**Rows vs cards.** Fixed track → full-bleed: `4 × 200px, gap 12px` → `3 × 200px` at 768 →
**`1 × 351px`** at 390. Note the difference from Craft: the card does not stay 200px, it grows to
fill the column. The 3-up 367px content grid goes to `1 × 614px` already at 768.

**Density.** Layout direction flips wholesale: flex-column containers 40 at 1440 → 26 at 390
while flex-row goes 15 → 11, i.e. the page is authored as rows-of-columns that unwind into one
column. The hero form is the nicest small detail: at 1440 the email field is 442px with the
`Get Started` button overlapping its lower edge; at 390 the field is full-width (~304px) and the
button becomes a **full-width pill directly under it**, still inside the same rounded container.
Split control at desktop, stacked control on phone, same visual object.

### 5. Tana Outliner (`outliner.tana.inc/daily-notes`)

**Navigation.** Header **72px tall at all three viewports**, dark theme.

| Viewport | Header contents                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440     | Wordmark 134×36 + 5 nav items (Explore ⌄, Learn, Templates, Pricing, Community) each **37px tall, 14px radius** + `New` badge + `Log in` 79×37 and `Sign up` 89×37 (4px radius) |
| 768      | Wordmark + **one 44×44 hamburger, 8px radius, `aria-label="Open menu"`**, 32px from the right edge. Log in / Sign up **gone from the header entirely**.                         |
| 390      | Same 44×44 hamburger, 16px from the right edge.                                                                                                                                 |

That 44×44 burger is the only correctly-sized touch target measured anywhere in this pass. Copy
its dimensions verbatim.

**Type scale.** Frozen, like Things: `h1` **40px/42.5px weight 375**, `h2` 32px/40px, body `p`
**18px/27px** — identical at 390, 768 and 1440. Only the measure moves: **703 → 576 → 358px**,
and the gutter with it: **312 → 96 → 16px**. The `h1` re-wraps 1 line → 2 lines → 2 lines and the
`h2`s go 40 → 80 → 120px tall as they wrap.

**Rows vs cards.** The container keeps a 12-column grid at every size, which at 390 means twelve
**15.15px tracks** with a 16px gap — harmless but pointless. The real content grid does
`5 × 166px` → `2 × 264px` → `1 × 358px`. Hero stays **left-aligned at every viewport** — no
centring on mobile, which keeps the reading ragged-right and the eye travel short.

**Do NOT copy.** Same failure as Things, worse: the product screenshots are `<video>` elements at
`1011×661` (1440) → `576×377` (768) → **`358×234` (390)**. A full Tana outliner window at 358px
wide is unreadable — confirmed in `tana-390.png`, where the "Yesterday, Mon, Jun 26" page is a
grey smear. Also, hiding **both** `Log in` and `Sign up` behind the burger at 768 means a
returning user on an iPad has no visible way back into the product.

---

## Rules for Campus mobile

Derived from what was actually measured at 390px, not from general advice. Each rule names the
product it came from.

### M1. Freeze the type scale. Change the measure, never the size.

`h1` 28px/32px, `h2` 20px/28px, body **16px/24px**, meta 13px — the _same values_ at 390, 768 and 1440. Let headings wrap to 2–3 lines instead of shrinking. _(Things and Tana both do exactly
this: `h1` 36px and 40px respectively, unchanged across all three viewports, with the measure
going 440→305px and 703→358px. They are the two most readable pages in the set at 390.)_
Corollary: **no font-size below 14px anywhere on a phone.** Supernotes' 15px caption becoming
13px at 390 is the one type regression in the whole pass.

### M2. Gutter 16px at 390, 24–32px at 768, centred ≤760px column above that.

Measured phone gutters: Tana **16px**, Supernotes 21px, Craft 24px, Anytype 31px, Things 40–43px.
16px is the tightest that still reads and it buys **358px of usable measure out of 390** — the
single biggest lever on how much fits. _(Tana: `h1` x=16, width 358.)_

### M3. One 44×44 menu button, top-right, 16px from the edge. Never edit the nav down.

Copy Tana's exact box: `44×44`, `border-radius: 8px`, `aria-label`, right inset 16px at 390 and
32px at 768. _(Tana's is the only compliant target measured. Anytype's is a 32px-wide box clipped
at `y=-10`; Craft's desktop links are 21px tall.)_ And never do Craft's 768 trick of silently
deleting two nav items — Campus has 5–6 destinations and all of them must stay reachable.

### M4. Auth and the primary action stay visible outside the drawer.

Keep `Hoy` / the primary CTA and the account affordance in the 390 header bar; only secondary
destinations go behind the button. _(Craft keeps its `Try Craft Free` pill at 113×36 next to the
burger at 390 — right instinct. Tana and Supernotes both bury Log in / Sign up at 768, which is
how you lose a returning student on a tablet.)_

### M5. Drawer rows are a separate component: 46–48px tall, full-width, 16px radius.

Do not restyle desktop nav links for touch — re-render them. Target: `min-height: 46px`,
`width: 100%` inside a 16px gutter (≈358px), 16px radius, 15–16px label. _(Craft's drawer items
measure exactly `310×46, radius 16px` versus its own 21px-tall desktop links. That is the whole
lesson in one before/after.)_

### M6. Rows stay rows. Two-column content collapses at 768→390, not at 1440→768.

Campus's Today/Plan/Courses lists must remain **ruled full-bleed rows** at 390 — 1px bottom rule,
`padding: 12px 0`, no card, no radius, no shadow — and any 2-up layout should survive 768 and
break only below it. _(Anytype's 4-up ruled band → 2-up at 768 → a single stacked column of ruled
cells at 390 is the pattern; Things holds `2 × 344px` at 768 and only goes 1-up at 390.)_
If something must become a card at 390, it grows to the full 358px like Supernotes' `1 × 351px`,
it does not stay a 240px chip like Craft's.

### M7. No fixed bottom overlay unless it is a real bottom nav with reserved space.

If Campus ever adds a floating bar, the scroll container must carry
`padding-bottom: <bar height + 24px>`. Anytype's 236×52 pill sits **10px off the bottom** at 390
and demonstrably covers a heading, a line of copy, _and_ steals the tap
(`elementsFromPoint` returns the pill). Measure `bottomGap` before shipping any `position: fixed`.

### M8. Never render a desktop screenshot below ~600px. Swap the asset or crop to one row.

At 390 a full app window scaled to 358px is illegible — proven twice (`tana-390.png` at 358×234,
`things-390.png` at 399×399). Campus should follow Craft, which swaps in a **phone-shaped asset**
(`310×642`) at 390 instead of scaling the desktop one; the cheap alternative is to crop the
screenshot to a single row or card at 1:1 pixel scale.

### M9. Native scroll is non-negotiable.

Assert it in the test suite: `document.documentElement.scrollHeight > window.innerHeight` on every
route at 390×844. _(Anytype fails this at all three viewports — 900/1024/844 — and it is the
reason its page cannot be read with a thumb.)_ Same test catches the other side of it:
`scrollWidth === innerWidth`, which all five sites pass and Campus must too.
