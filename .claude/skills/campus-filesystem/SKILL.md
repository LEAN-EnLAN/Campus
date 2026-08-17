---
name: campus-filesystem
description: Vault file operation rules — VaultAccess surface, path safety, trash, conflicts. Use when touching src/lib/vault/, src/server/vault-api*, or any file mutation.
---

# Campus filesystem

## One authority

`VaultRepository` (server side) is the ONLY path resolver. The browser holds a
thin `HttpVaultAccess`; client-side path checks are theatre. The wire surface is
EXACTLY `VaultAccess` (readNote, writeNote, listDir, mkdir, rename, trash,
stat) — port primitives (realpath, readdir, lstat, remove) never ride the wire.
Adding a wire operation = adding attack surface; it needs hostile-path tests in
`src/server/vault-api.test.ts` (traversal, absolute, symlink escape, escaping
rename destination) BEFORE it ships.

## Data-loss rules

- rename REFUSES an existing destination (typed `VaultConflictError`). POSIX
  rename overwrites silently; the filesystem default is the bug.
- delete is trash-not-unlink: content moves to `.campus/trash/` with a
  `.meta.json` sidecar recording `originalPath`. Trash is canonical student
  data.
- writeNote presents the mtime it loaded; `null` = "I believe this is new".
  Mismatch is a conflict the STUDENT resolves. Never adopt a fresh mtime to
  force a write except as the student's explicit "conservar mi versión".

## Paths

Vault-relative always. Windows rules everywhere (reserved names, forbidden
chars, trailing dot/space) — `path-resolver.ts`. `.campus/` is hidden at the
vault root by `listDir`, not by the UI.
