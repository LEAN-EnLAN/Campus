# Campus — Visual reference notes

Research pass against `docs/design.md` ("academic field notebook + quiet operations desk").
Every claim below comes from a screenshot in `docs/research/screenshots/` that was opened and
read, or from the marketing/docs copy of the page.

## Capture conditions (read this before trusting a pixel measurement)

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
