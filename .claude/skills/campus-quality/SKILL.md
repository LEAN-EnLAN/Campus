---
name: campus-quality
description: Campus verification doctrine — developer-harness integration, quality tiers, the deterministic check set, browser viewport matrix, accessibility policy, candidate freezing and receipt requirements. Use before claiming anything works, when running checks, verifying UI, or preparing delivery. Enforces claimed ≠ verified.
---

# Campus — quality & evidence

## The rule everything else serves

> **Claimed ≠ verified.** A check you did not run is not evidence. "Tests pass" without a
> `test` evidence record is a claim, and claims do not ship.

Agent narration has zero completion authority. Report what the evidence says, not how
confident you feel.

## Harness

```bash
H=~/Documents/GitHub/developer-harness/src/cli/index.mjs

node $H status --json                 # infra gate + quality profile + RDD state
node $H route "<request>" --json      # DIRECT | DELEGATED | SDD
node $H component "<intent>" --json   # before authoring UI
node $H check cheap --json            # fast loop
node $H check candidate --json        # full deterministic set
node $H candidate --json              # freeze content-addressed identity
node $H review --json                 # arbitrated review plan
node $H authorize pre-commit --json   # delivery authorization
```

If `infra.ok:false` → stop and run `claude-dev-infra repair`. Never repair infra by hand.

## Deterministic check set — all must be real commands with real exit codes

| Class                  | Command             |
| ---------------------- | ------------------- |
| format                 | `pnpm format:check` |
| lint                   | `pnpm lint`         |
| typecheck              | `pnpm typecheck`    |
| unit tests             | `pnpm test`         |
| integration / DB / RLS | `pnpm test:db`      |
| build                  | `pnpm build`        |
| UI verification        | `pnpm verify:ui`    |
| accessibility          | `pnpm verify:a11y`  |

**No fake scripts.** A script that echoes success and exits 0 is fraud, not tooling. If a
class genuinely cannot run in this environment, say so explicitly and mark it missing —
missing evidence is never "passed".

## Tiers

- **cheap** — format, lint, typecheck. Run constantly while implementing.
- **candidate** — everything above plus tests, DB tests, build. Run before freezing.
- **delivery** — candidate plus UI verification and accessibility. Required for a receipt.

## Failure protocol

1. Classify the cause: implementation / test / environment / pre-existing.
2. Make **one** bounded fix.
3. Re-run only the affected check.
4. Maximum 2 attempts, then stop and report the failure honestly.

**Never edit a test purely to make it green.** If the test is right and the code is wrong,
fix the code.

## Browser / viewport matrix — CAP-RESPONSIVE-001

Every primary screen is verified at:

| Viewport | Context         |
| -------- | --------------- |
| 360×800  | small Android   |
| 390×844  | iPhone          |
| 768×1024 | tablet portrait |
| 1280×800 | laptop          |
| 1440×900 | desktop         |

At each viewport capture: **render status**, **runtime console errors**, **horizontal
overflow** (`document.documentElement.scrollWidth > clientWidth`), a **screenshot**, and the
outcome of the screen's critical interaction.

Tooling order: `t3-code preview` → local app · `camofox` → fallback · `agent-capture` →
durable evidence artifacts. Screenshots land under `evidence/ui/<candidate>/`.

Horizontal overflow at 360px is a **defect**, not a cosmetic note.

## Accessibility policy — CAP-A11Y-001

A real engine (axe-core) runs against the rendered app, not a linter approximating one.

- **critical > 0 → BLOCK**
- **serious > 0 → BLOCK**
- moderate/minor → recorded, triaged, not blocking for the POC

Every route in the matrix gets an a11y scan in at least one mobile and one desktop viewport.
Report exact counts per route. "No violations found" without a scan record is a claim.

## Evidence binding

UI and a11y evidence is **candidate-bound**: it references the frozen candidate hash. Any
edit after freezing invalidates the receipt — re-freeze and re-run the invalidated evidence.
Evidence from a different candidate is not evidence for this one.

No raw log blobs in model context — evidence lives in files, summaries come back as counts
and exit states.

## Receipt requirements

A valid receipt references:

candidate identity · PRD requirement IDs · SDD task IDs · format · lint · typecheck · tests ·
DB/RLS · build · UI viewport evidence · accessibility counts · review outcome · authorization state.

Never fabricate a receipt. If authorization is refused, lead with that and name the missing
evidence.

## RDD flow

```text
deterministic evidence green
→ freeze candidate
→ Gentle-AI default 4R review
→ refuter
→ bounded correction if severe
→ rerun invalidated evidence
→ freeze final candidate
→ produce receipt
```

Do **not** invoke Judgment Day or ultrareview automatically.

## Stop conditions — report honestly, never fake around

- Supabase cannot start (Docker down)
- RLS cannot be tested
- the browser cannot render the app
- the accessibility engine is unavailable
- an academic source cannot be verified
- the candidate cannot be identified
- the receipt cannot validate

When one of these hits: state it, continue independent safe work, and do not claim the
blocked class passed.

## Git

Never `git push`, merge, or commit unless the user asked. Conventional commits only,
no AI attribution.
