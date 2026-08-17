# Workspace performance — Prompt 2 baseline

Measured 2026-08-16 on the dev machine (Linux, Node 25) via
`tests/unit/workspace-perf.test.ts` — the same pure-TS index the browser runs,
measured without a browser's noise. Wall-clock numbers are one machine's; the
regression signal is the SHAPE.

| notes | build ms | search ms | quick-switch ms | backlinks ms | incremental upsert ms |
| ----: | -------: | --------: | --------------: | -----------: | --------------------: |
|   100 |        2 |      0.08 |            0.04 |        0.016 |                  0.11 |
| 1,000 |       11 |      0.24 |            0.16 |        0.011 |                  0.08 |
| 5,000 |       32 |      2.25 |            0.85 |        0.008 |                  0.08 |

## Reading

- **Build scales linearly** (≈6µs/note): 5,000 notes index in 32ms, so the
  Prompt 2 target ("5k notes must not make startup/switcher/search unusable")
  is met with two orders of magnitude of headroom. The real-world cost at
  startup is dominated by reading the files over the loopback transport, not
  by indexing.
- **Backlinks are size-independent** (inverted incoming-link map): the
  functional guarantee lives in `vault-index.test.ts` (backlinks touch only
  real sources); this table shows its consequence.
- **Search is the only super-linear-looking row** (body scan is O(notes)); at
  2.25ms for 5k it needs nothing today. If vaults grow 10×, the first lever is
  an inverted term index, not virtualization.
- **Incremental upsert is flat** — the editor's per-save index update costs
  under 0.1ms regardless of vault size, which is what keeps autosave honest.

## Not yet measured

Cold vault open over HTTP (files transport), explorer render with thousands of
siblings (virtualization deliberately NOT added — measure first), editor open
latency on very large single documents.
