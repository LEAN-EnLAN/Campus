/**
 * Command palette registry. Pure, no React: components register commands on
 * mount and the palette queries this at render time, so keeping it framework
 * free means both sides can be tested without a DOM.
 *
 * The registry answers three questions the palette needs:
 *   - what CAN run right now (`available`, gated by each command's `when`)
 *   - what matches what the student typed (`find`, ranked and bounded)
 *   - is it still legal to run this id (`run`, which re-checks availability)
 */

export interface CommandContext {
  activeNotePath: string | null
  activeCourseId: string | null
  paneCount: number
  sidebarOpen: boolean
}

export interface Command {
  id: string
  label: string
  /** Extra search terms — synonyms the label does not contain. */
  keywords?: string[]
  /** Display hint like `Mod+P`. The registry detects collisions, never remaps. */
  shortcut?: string
  /** Absent means "always available". */
  when?: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext) => void | Promise<void>
}

/** The palette shows a screenful, not an archive. More than 20 matches means "type more". */
const MAX_RESULTS = 20

/**
 * Case- and diacritic-insensitive normalization, so "sesion" finds "Sesión".
 * NFD splits accented letters into base + combining mark; stripping the marks
 * leaves the base letter students actually type on a hurried keyboard.
 */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Lower ranks first: a label prefix beats a label substring beats a keyword hit.
 * Plain consts, not an enum: the project compiles with `erasableSyntaxOnly`,
 * which rejects enums because they emit runtime code.
 */
const RANK_LABEL_STARTS_WITH = 0
const RANK_LABEL_INCLUDES = 1
const RANK_KEYWORD = 2

function rank(cmd: Command, query: string): number | null {
  const label = normalize(cmd.label)
  if (label.startsWith(query)) return RANK_LABEL_STARTS_WITH
  if (label.includes(query)) return RANK_LABEL_INCLUDES
  if (cmd.keywords?.some((k) => normalize(k).includes(query))) return RANK_KEYWORD
  return null
}

export class CommandRegistry {
  /** Map preserves insertion order, which is exactly the "stable registration order" contract. */
  private commands = new Map<string, Command>()

  /**
   * Register (or replace) a command. Same id replaces — last wins — so a hot
   * reload that re-runs a module's registration does not duplicate entries.
   */
  register(cmd: Command): () => void {
    this.commands.set(cmd.id, cmd)
    return () => {
      // Unregister only what THIS call registered. If a newer registration
      // already replaced the id (hot reload again), a stale cleanup running
      // late must not tear down the live command.
      if (this.commands.get(cmd.id) === cmd) {
        this.commands.delete(cmd.id)
      }
    }
  }

  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  /** Commands whose `when` passes (or is absent), in registration order. */
  available(ctx: CommandContext): Command[] {
    const result: Command[] = []
    for (const cmd of this.commands.values()) {
      if (!cmd.when || cmd.when(ctx)) result.push(cmd)
    }
    return result
  }

  /**
   * Search available commands. Ranked label-prefix > label-substring > keyword;
   * ties keep registration order because `sort` is stable. An empty query
   * returns everything available (the palette's initial, unfiltered view).
   */
  find(query: string, ctx: CommandContext): Command[] {
    const needle = normalize(query.trim())
    const pool = this.available(ctx)
    if (needle === '') return pool.slice(0, MAX_RESULTS)

    return pool
      .map((cmd) => ({ cmd, rank: rank(cmd, needle) }))
      .filter((entry): entry is { cmd: Command; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.cmd)
  }

  /**
   * Run by id, but only if the command is still available. The palette races
   * the app: between rendering a result and the student pressing Enter, the
   * context may have changed (pane closed, note trashed). Executing a command
   * whose preconditions vanished is worse than doing nothing, so an
   * unavailable id is a no-op that reports `false`.
   */
  async run(id: string, ctx: CommandContext): Promise<boolean> {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    if (cmd.when && !cmd.when(ctx)) return false
    await cmd.run(ctx)
    return true
  }

  /** shortcut → command id. On collision the LAST registration wins the map slot. */
  shortcuts(): Map<string, string> {
    const map = new Map<string, string>()
    for (const cmd of this.commands.values()) {
      if (cmd.shortcut) map.set(cmd.shortcut, cmd.id)
    }
    return map
  }

  /**
   * Report shortcuts claimed by more than one command. Detection only: the
   * registry has no idea which command the student values more, so remapping
   * here would silently pick a winner. Surfacing the conflict is the job.
   */
  detectCollisions(): { shortcut: string; ids: string[] }[] {
    const byShortcut = new Map<string, string[]>()
    for (const cmd of this.commands.values()) {
      if (!cmd.shortcut) continue
      const ids = byShortcut.get(cmd.shortcut) ?? []
      ids.push(cmd.id)
      byShortcut.set(cmd.shortcut, ids)
    }
    return [...byShortcut.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([shortcut, ids]) => ({ shortcut, ids }))
  }
}
