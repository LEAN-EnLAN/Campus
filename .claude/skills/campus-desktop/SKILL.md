---
name: campus-desktop
description: Campus desktop and local-server doctrine — Tauri 2 capability scoping, the shared boundary between desktop and `campus serve`, Windows/Linux differences, loopback-only binding, and the separated verification levels (configured/built/runtime/installer). Use when touching src-tauri, the local server, or packaging.
---

# Campus — desktop and local server

## Two shells, one frontend

```text
        the same Vite frontend
                  │
        ┌─────────┴─────────┐
     Tauri 2           campus serve
        │                   │
   campus-core         campus-server → campus-core
```

The frontend must not know which shell it is in. It talks to `CampusBackend`; the shell
decides what implements it. An `if (isTauri)` in a component is the boundary leaking.

## Capabilities are vault-scoped. Always.

Tauri's filesystem scope is granted to **the selected vault**, not to `$HOME`, not to
`$DOCUMENT`, not to `**`. The student picks a folder through a native dialog; that folder
becomes the scope, at runtime.

A broad static scope in `capabilities/*.json` defeats the entire security model of the vault
layer — path checking in `campus-core` is worth nothing if the shell already handed out the
whole home directory.

- open/create folder through the native dialog
- recent vaults persisted (paths are **device-scoped settings**, they never sync)
- window position and size persisted
- deep links / "open with" are later work, and each one widens the surface — treat as such

## Local server

```bash
campus serve ~/Campus
```

```text
Campus
Vault  /home/you/Campus
URL    http://127.0.0.1:4815
```

Non-negotiable:

- **binds loopback by default.** Never `0.0.0.0` without an explicit, deliberate user choice
  and a warning that says what it means.
- serves exactly one vault, the one named on the command line
- every path is resolved and scope-checked server-side; traversal and symlink escape are
  rejected. The HTTP layer does not get to trust the client.
- no ambient authority: the process must not be a general file server that happens to open in
  a browser

If the server is later exposed deliberately, that is a separate feature with its own auth
design — not a flag.

## Windows and Linux differ in ways that will bite

|                      | Linux                                    | Windows                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------ |
| path separator       | `/`                                      | `\`, and case-insensitive                        |
| reserved names       | —                                        | `CON`, `PRN`, `AUX`, `NUL`, `COM1..9`, `LPT1..9` |
| path length          | ~4096                                    | 260 unless long paths enabled                    |
| file locking         | advisory                                 | mandatory — an open file may be unrenamable      |
| watcher              | inotify, has limits (`max_user_watches`) | ReadDirectoryChangesW                            |
| atomic rename        | yes, same filesystem                     | mostly, but a lock can fail it                   |
| trailing dots/spaces | legal                                    | silently stripped                                |

A vault created on one and opened on the other must not corrupt. Filename validation belongs
in `campus-core`, applying the **stricter** rules everywhere, so a note created on Linux does
not become unopenable on Windows.

## Verification levels are separate claims

Never collapse these. Each is a different sentence with different evidence.

```text
CONFIGURED         the build config exists and is committed
BUILT              an artefact was produced, on this platform, and its hash recorded
RUNTIME_VERIFIED   the artefact was launched on that OS and did the thing
INSTALLER_VERIFIED the installer was run on that OS and the result works
```

**A Windows installer cannot be RUNTIME_VERIFIED from Linux.** Cross-compiling produces an
artefact, not evidence. Say `BUILT (cross-compiled, not runtime verified)` and leave it
blocked until a Windows host exists. Claiming otherwise is exactly the fabrication the
quality doctrine forbids.

Linux target: at least one artefact a student can double-click (AppImage), **plus** the local
server so that testing local mode never requires installing anything.

## Review checklist

- [ ] does any component branch on which shell it is running in?
- [ ] is the Tauri filesystem scope the vault, granted at runtime?
- [ ] does the server bind loopback?
- [ ] are paths scope-checked server-side, not just in the client?
- [ ] do filename rules apply Windows-strict everywhere?
- [ ] is every packaging claim labelled with its actual verification level?
