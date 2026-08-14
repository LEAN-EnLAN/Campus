---
name: campus-code-runner
description: Campus code execution doctrine — execution is never automatic, the runner registry, worker and container isolation, timeouts, memory and output bounds, network disabled by default, and the evidence required before calling anything sandboxed. Use when building or reviewing any code execution path.
---

# Campus — running code

## The rule that outranks every other

> **Opening a note never runs code.**

Not on open, not on preview, not on index, not on search, not on hover, not on template
insertion, not "just to get the output for the snippet". Execution happens because the
student pressed a button, every time.

A note is a document that arrived from somewhere — a classmate, a repo, a download. Treat
every code block as hostile input.

## Runner registry

```ts
interface CodeRunner {
  id: string
  languages: string[]
  availability(): Promise<RunnerAvailability>
  run(request: RunRequest): Promise<RunHandle>
}
```

- runners register themselves; there is no switch statement over language names
- `availability()` is what Settings renders — a runner that cannot run says why, in words a
  student understands ("Podman no está instalado")
- the exact API may evolve; the registry shape must not become a plugin marketplace

## Bounds are mandatory, not configurable away

Every runner, every language, every time:

```text
wall-clock timeout          the loop must be killable
memory ceiling
stdout cap                  a program printing forever must not take the tab down
stderr cap
process cap                 (container runners)
CPU limit                   (container runners)
```

`stop` must actually terminate. A "stop" button that only stops listening is a lie — for
workers that means `worker.terminate()`, for containers a real kill.

## Isolation tiers

| Tier           | Boundary                                        | Use                                        |
| -------------- | ----------------------------------------------- | ------------------------------------------ |
| **Web Worker** | the browser's own sandbox, no DOM, no host APIs | Python via Pyodide, JS                     |
| **Container**  | Podman/Docker, rootless preferred               | compiled languages that cannot run in WASM |

Never execute on the main thread. Not for "small" snippets, not for "trusted" notes.

### Web Worker invariants

- no DOM access, no `window`, no host bridge injected into the worker
- the worker receives source and input; it returns stdout, stderr, status, duration
- no automatic network. Pyodide must not fetch arbitrary packages because the code asked

### Container invariants

Defaults, all of them:

```text
network: none
no privileged
no Docker/Podman socket mounted
vault NOT mounted writable        ← the student's notes are not the runner's workspace
ephemeral workspace
explicit input files only
read-only root filesystem where possible
CPU, memory, pids and wall limits
```

Container runners default to **disabled**. The student turns them on knowing what they are.

## Package installation

Explicit policy, surfaced in the UI. Campus does not silently download packages because a
snippet imported something. "It worked on my machine because it quietly pip-installed" is a
supply-chain hole wearing a convenience costume.

## The word "sandboxed"

Do not write it in the UI, docs or a release note without evidence of the actual boundary.

Required before the claim:

```text
infinite loop                → terminated by timeout
huge stdout                  → capped, UI survives
huge stderr                  → capped
memory pressure              → bounded, no host OOM
terminate mid-run            → process actually gone
filesystem access attempt    → denied, recorded
network attempt              → denied, recorded
process spawn attempt        → denied, recorded
vault write attempt          → denied, recorded
host file read attempt       → denied, recorded
```

Each of these is an executed test with a recorded result, run safely. A security claim
without an executed check is exactly the "claimed ≠ verified" failure the quality skill
exists to prevent.

## Review checklist

- [ ] can any path run code without an explicit user action?
- [ ] is there a timeout, and does stop actually terminate?
- [ ] are stdout/stderr bounded?
- [ ] is network off by default?
- [ ] is the vault reachable from inside the runner? (it must not be)
- [ ] does the UI claim "sandboxed"? then where is the evidence?
