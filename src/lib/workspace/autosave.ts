import type { FilesAccess } from '@/lib/files/context'
import { VaultError } from '@/lib/vault/errors'
import { vaultErrorMessage } from '@/lib/vault/error-messages'

/**
 * Autosave for one open note: a small state machine with ONE rule above all
 * others — the footer says `Guardado` only when the text in the editor is the
 * text on disk.
 *
 *   edit → debounce → writeNote(text, knownMtime) → stat → new mtime
 *
 * What the previous loop got wrong, and what this does instead:
 *
 * - It cleared its "dirty" flag when a write FINISHED, not by comparing what
 *   had been written with what is in the editor now. Anything typed while the
 *   write was in the air was marked saved and never written. Here, "saved"
 *   means `editor text === baseline`, where the baseline is the exact text of
 *   the last successful write (or load). Dirtiness is derived, never tracked.
 * - Saves could overlap, so the second presented a stale mtime and the server
 *   correctly reported a conflict nobody had caused. Here there is ONE save
 *   loop at a time; edits that arrive during it are written by the same loop.
 * - Loading an external change counted as an edit and rewrote the file. Here
 *   the baseline is set to the loaded text first, so the reload is not dirty.
 *
 * The write itself is VAULT-003's conflict check (mtime compared on the
 * privileged side, atomic rename). This class only decides WHEN to write and
 * WHAT to tell the student; it never weakens that check.
 *
 * Framework-free on purpose: the editor (CodeMirror) is a `host`, so every rule
 * is testable without a DOM.
 */

export type SaveState =
  | { kind: 'saved' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  /** The file changed on disk AND we hold unsaved edits. The student decides. */
  | { kind: 'conflict' }
  /** The file is gone or was moved while we hold the only copy of the text. */
  | { kind: 'missing' }

export interface AutosaveHost {
  /** The text in the editor right now. */
  readText(): string
  /** Swap the editor's whole text. The host may report it as a document change. */
  replaceText(text: string): void
}

export interface AutosaveOptions {
  files: FilesAccess
  path: string
  host: AutosaveHost
  onState(state: SaveState): void
  /** After a successful write, so the knowledge index stays incremental. */
  onSaved?(path: string, contents: string): void
  debounceMs?: number
}

export const AUTOSAVE_MS = 800

export class NoteAutosave {
  state: SaveState = { kind: 'saved' }

  private readonly files: FilesAccess
  private readonly path: string
  private host: AutosaveHost
  private readonly emit: (state: SaveState) => void
  private readonly onSaved?: (path: string, contents: string) => void
  private readonly debounceMs: number

  /** Exactly the text the disk held after the last load or successful write. */
  private baseline = ''
  /** The mtime our next write must present. */
  private mtime = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private disposed = false

  constructor(options: AutosaveOptions) {
    this.files = options.files
    this.path = options.path
    this.host = options.host
    this.emit = options.onState
    this.onSaved = options.onSaved
    this.debounceMs = options.debounceMs ?? AUTOSAVE_MS
  }

  /** Does the editor hold text the disk does not? The question every leave-gate asks. */
  unsaved(): boolean {
    return this.host.readText() !== this.baseline
  }

  /** Read the note into the editor. Rejects if it cannot be read. */
  async load(): Promise<void> {
    const note = await this.files.readNote(this.path)
    if (this.disposed) return
    this.adopt(note.contents, note.mtimeMs)
  }

  /** The editor's document changed (typing, paste, undo — not our own reload). */
  edited(): void {
    if (this.disposed) return
    if (this.blocked()) return
    if (!this.unsaved()) {
      // Undone back to what is on disk: nothing to write.
      this.clearTimer()
      if (!this.inFlight) this.set({ kind: 'saved' })
      return
    }
    if (!this.inFlight) this.set({ kind: 'dirty' })
    this.schedule()
  }

  /** Write now. Safe to call at any time: calls during a save join the same loop. */
  save(): Promise<void> {
    this.clearTimer()
    if (this.inFlight) return this.inFlight
    this.inFlight = this.run().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /**
   * Resolve once everything typed so far is on disk — or has definitively
   * failed. Callers that are about to destroy the editor (closing a tab,
   * switching notes) await this and then ask `unsaved()`.
   */
  async flush(): Promise<void> {
    this.clearTimer()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.save()
      if (!this.unsaved()) return
      // A failed save is not retried here: asking a broken server five times
      // in a row only delays telling the student.
      if (this.state.kind === 'error' || this.blocked()) return
    }
  }

  /**
   * For unmount: the editor is about to disappear, so capture its text NOW and
   * save that. Fire-and-forget by necessity; callers that must know the outcome
   * use `flush()` first.
   */
  disposeAndFlush(): void {
    const text = this.host.readText()
    this.clearTimer()
    if (text !== this.baseline && !this.blocked()) {
      this.host = { readText: () => text, replaceText: () => {} }
      void this.save()
    }
    this.disposed = true
  }

  dispose(): void {
    this.disposed = true
    this.clearTimer()
  }

  /**
   * The disk may have changed underneath an open note (git, Syncthing, the
   * student's other editor). Called on a poll and on window focus.
   */
  async checkExternal(): Promise<void> {
    if (this.disposed || this.inFlight || this.blocked()) return
    try {
      const fresh = await this.files.stat(this.path)
      if (this.disposed || !fresh || fresh.mtimeMs === this.mtime) return
      if (this.inFlight) return

      if (this.unsaved()) {
        this.set({ kind: 'conflict' })
        return
      }
      const before = this.host.readText()
      const note = await this.files.readNote(this.path)
      if (this.disposed) return
      // Typed while we were reading: replacing the text now would eat it.
      if (this.host.readText() !== before || this.inFlight) {
        this.set({ kind: 'conflict' })
        return
      }
      this.adopt(note.contents, note.mtimeMs)
    } catch {
      // A transient failure must not spam the student; the next poll retries.
    }
  }

  /** "Recargar del disco": drop my text, show the disk's. */
  async reload(): Promise<void> {
    try {
      const note = await this.files.readNote(this.path)
      if (this.disposed) return
      this.adopt(note.contents, note.mtimeMs)
    } catch (error) {
      this.fail(error)
    }
  }

  /** "Conservar mi versión": adopt the disk's mtime as the base so MY text wins. */
  async keepMine(): Promise<void> {
    try {
      const fresh = await this.files.stat(this.path)
      if (!fresh) {
        this.set({ kind: 'missing' })
        return
      }
      this.mtime = fresh.mtimeMs
      this.set({ kind: 'dirty' })
      await this.save()
    } catch (error) {
      this.fail(error)
    }
  }

  /** "Guardar como nueva": the file is gone, so write the editor text as a new file. */
  async saveAsNew(): Promise<void> {
    try {
      const text = this.host.readText()
      this.set({ kind: 'saving' })
      await this.files.writeNote(this.path, text, null)
      await this.adoptWritten(text)
      this.afterWrite()
    } catch (error) {
      this.fail(error)
    }
  }

  // ---------------------------------------------------------------- internals

  private blocked(): boolean {
    return this.state.kind === 'conflict' || this.state.kind === 'missing'
  }

  private async run(): Promise<void> {
    // One loop. Whatever is typed while a write is in the air is picked up by
    // the next lap, so there is never a second, overlapping save.
    for (;;) {
      if (this.disposed && this.host.readText() === this.baseline) return
      if (this.blocked()) return
      const text = this.host.readText()
      if (text === this.baseline) {
        this.set({ kind: 'saved' })
        return
      }
      this.set({ kind: 'saving' })
      try {
        await this.files.writeNote(this.path, text, this.mtime)
        await this.adoptWritten(text)
      } catch (error) {
        this.fail(error)
        return
      }
      if (this.host.readText() === this.baseline) {
        this.set({ kind: 'saved' })
        return
      }
    }
  }

  /** After our own write: remember its text and the mtime it produced. */
  private async adoptWritten(text: string): Promise<void> {
    const fresh = await this.files.stat(this.path)
    if (fresh) this.mtime = fresh.mtimeMs
    this.baseline = text
    this.onSaved?.(this.path, text)
  }

  private afterWrite(): void {
    if (this.unsaved()) {
      this.set({ kind: 'dirty' })
      this.schedule()
    } else {
      this.set({ kind: 'saved' })
    }
  }

  /** Make `contents` the truth: the baseline FIRST, so showing it is not an edit. */
  private adopt(contents: string, mtimeMs: number): void {
    this.clearTimer()
    this.baseline = contents
    this.mtime = mtimeMs
    if (this.host.readText() !== contents) this.host.replaceText(contents)
    this.set({ kind: 'saved' })
  }

  private fail(error: unknown): void {
    if (this.disposed) return
    const code = error instanceof VaultError ? error.code : null
    if (code === 'conflict_missing' || code === 'not_found') {
      this.clearTimer()
      this.set({ kind: 'missing' })
    } else if (code === 'conflict_changed' || code === 'already_exists') {
      // Not an error to retry: the student has two versions of their own work,
      // and retrying would just be refused again.
      this.clearTimer()
      this.set({ kind: 'conflict' })
    } else {
      this.set({ kind: 'error', message: vaultErrorMessage(error) })
    }
  }

  private set(state: SaveState): void {
    this.state = state
    if (!this.disposed) this.emit(state)
  }

  private schedule(): void {
    this.clearTimer()
    this.timer = setTimeout(() => void this.save(), this.debounceMs)
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
