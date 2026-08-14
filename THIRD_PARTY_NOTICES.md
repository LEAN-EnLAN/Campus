# Third-party notices

**Last reviewed:** 2026-08-14
**Scope:** the `campus-poc` repository.

## What this file is for

This file exists to keep Campus honest about other people's work. It has two jobs:

1. **Attribution for what we ship.** Some licences (BSD, Apache-2.0, MIT, OFL) require that
   their copyright notice and licence text travel with any redistribution. Campus is a web
   application, so the moment we ship a bundle, we are redistributing those dependencies.
   Section 1 records them.
2. **A provenance ledger for reused code.** If Campus ever copies or ports source code from
   another project — as opposed to installing it from a package registry — the copied file,
   its origin, its licence, and the retained copyright header get recorded in section 2. That
   record is what makes the reuse defensible instead of accidental.

The rules that decide whether reuse is allowed at all live in
[`docs/research/open-source-reuse.md`](docs/research/open-source-reuse.md). Short version:
permissive (MIT/BSD/ISC/Apache-2.0) may be reused with provenance and notice; GPL/AGPL,
proprietary, and unverified licences are reference-only.

## 1. Dependencies Campus ships

These are installed from npm and bundled into the client build. Versions are the ones resolved
in `pnpm-lock.yaml` at the date above; licence values were read from each package's own
`package.json` and `LICENSE` file inside `node_modules`, not from a registry summary page.

| Package                    | Version  | Licence        | Copyright holder                                                    |
| -------------------------- | -------- | -------------- | ------------------------------------------------------------------- |
| `react`                    | 19.2.8   | MIT            | Meta Platforms, Inc. and affiliates                                 |
| `react-dom`                | 19.2.8   | MIT            | Meta Platforms, Inc. and affiliates                                 |
| `@tanstack/react-router`   | 1.170.27 | MIT            | Tanner Linsley                                                      |
| `@tanstack/react-query`    | 5.101.4  | MIT            | Tanner Linsley                                                      |
| `@supabase/supabase-js`    | 2.112.3  | MIT            | Supabase                                                            |
| `clsx`                     | 2.1.1    | MIT            | Luke Edwards                                                        |
| `tailwind-merge`           | 3.6.0    | MIT            | Dany Castillo                                                       |
| `date-fns`                 | 4.4.0    | MIT            | Sasha Koss and contributors                                         |
| `class-variance-authority` | 0.7.1    | **Apache-2.0** | Joe Bell                                                            |
| `lucide-react`             | 0.544.0  | ISC            | Lucide Contributors (icon set forked from Feather, Cole Bemis, MIT) |
| `tailwindcss` (build-time) | 4.1.x    | MIT            | Tailwind Labs, Inc.                                                 |

**Apache-2.0 note.** `class-variance-authority` is the only Apache-2.0 runtime dependency.
Apache-2.0 §4 requires that we retain its copyright, licence, and any `NOTICE` file contents
in redistributions. The package ships no `NOTICE` file, so retaining the licence text and this
table entry satisfies the obligation. Apache-2.0 also carries an explicit patent grant, which
is a benefit, not a burden — but it does mean CVA cannot be silently vendored without this
notice.

**Lucide note.** Lucide is ISC-licensed and derives from Feather Icons (MIT, Cole Bemis). Both
notices are reproduced inside `node_modules/lucide-react/LICENSE`; the attribution above is the
shipped acknowledgement.

**Fonts.** `index.html` loads **Inter** and **Newsreader** from Google Fonts over the network.
Both are licensed under the SIL Open Font License 1.1. No font binary is committed to this
repository or bundled into the build, so the OFL's redistribution clauses are not currently
triggered. If Campus ever self-hosts these fonts (a likely step for offline/PWA support), the
`OFL.txt` for each family must be committed alongside the font files and listed here.

## 2. Copied or ported source code

**Nothing has been copied or ported into this repository. This section is intentionally empty.**

That is a factual statement, not a placeholder disclaimer. Every third-party artefact in
Campus today arrives through `package.json` and lives in `node_modules`. `src/` contains no
file that originated in another project's source tree.

The one place worth being precise about is the UI layer. `src/components/ui/` and
`src/lib/utils.ts` follow **shadcn/ui** conventions — the `cva` + `cn(clsx, twMerge)` idiom, the
variant-map component shape. shadcn/ui is MIT (Copyright shadcn), and its whole distribution
model is "copy this into your project", so copying would be permitted. We did not: the
components were written against Campus's own design tokens (`docs/design.md`), and no
`components.json` or shadcn CLI registry is configured. The `cn` helper is a four-line,
widely-reproduced idiom rather than a substantial portion of the work. We record the influence
here anyway, because provenance that is written down before it is needed is worth more than
provenance reconstructed afterwards.

### How to add an entry here

When code is genuinely copied or ported, add a row and do all three of these:

1. Keep the original copyright header **in the file itself**. Do not strip it.
2. Add a comment at the top of the copied file stating the upstream URL, the commit or tag it
   came from, and the licence.
3. Record it below.

| Campus file  | Upstream project | Upstream file | Commit / tag | Licence | Notes |
| ------------ | ---------------- | ------------- | ------------ | ------- | ----- |
| _(none yet)_ |                  |               |              |         |       |

### Known trap for future reuse

If Campus ever ports SilverBullet's Live Preview CodeMirror extensions, note that
`client/codemirror/hide_mark.ts`, `client/codemirror/list.ts` and `client/codemirror/util.ts`
are **not** covered by SilverBullet's MIT licence alone. They are forks of
[ixora](https://codeberg.org/retronav/ixora) by Pranav Karawale and carry an **Apache-2.0**
header. Porting them means honouring Apache-2.0 attribution — retaining the header and adding
a row above — not just MIT attribution to Zef Hemel. This is exactly the kind of detail that
gets lost when code is copied without reading the file headers.

## 3. Reference-only projects

Campus's research reads several projects for architecture and UX ideas without reusing their
code. Ideas, interface shapes, and design decisions are not copyrightable; source code is.
Projects under GPL/AGPL or proprietary licences are studied and cited in
`docs/research/open-source-reuse.md`, and **no code from them appears in Campus**. They are
listed there rather than here, because reading a project creates a citation obligation, not a
licence obligation.
