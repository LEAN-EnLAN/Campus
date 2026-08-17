import { describe, expect, it, vi } from 'vitest'
import { CommandRegistry, type Command, type CommandContext } from './registry'

const ctx = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  activeNotePath: null,
  activeCourseId: null,
  paneCount: 1,
  sidebarOpen: false,
  ...overrides,
})

const cmd = (id: string, overrides: Partial<Command> = {}): Command => ({
  id,
  label: id,
  run: () => {},
  ...overrides,
})

describe('CommandRegistry', () => {
  describe('register', () => {
    it('replaces on re-register of the same id instead of duplicating', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('note.open', { label: 'Old label' }))
      registry.register(cmd('note.open', { label: 'New label' }))

      const available = registry.available(ctx())
      expect(available).toHaveLength(1)
      expect(available[0]?.label).toBe('New label')
    })

    it('returns an unregister function that removes the command', () => {
      const registry = new CommandRegistry()
      const unregister = registry.register(cmd('note.open'))

      unregister()

      expect(registry.get('note.open')).toBeUndefined()
      expect(registry.available(ctx())).toHaveLength(0)
    })

    it('a stale unregister does not remove a newer registration of the same id', () => {
      const registry = new CommandRegistry()
      const unregisterOld = registry.register(cmd('note.open', { label: 'Old' }))
      registry.register(cmd('note.open', { label: 'New' }))

      unregisterOld()

      expect(registry.get('note.open')?.label).toBe('New')
    })
  })

  describe('available', () => {
    it('includes commands without a when clause and filters by when', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('always'))
      registry.register(cmd('needs-note', { when: (c) => c.activeNotePath !== null }))

      const withoutNote = registry.available(ctx())
      expect(withoutNote.map((c) => c.id)).toEqual(['always'])

      const withNote = registry.available(ctx({ activeNotePath: 'a.md' }))
      expect(withNote.map((c) => c.id)).toEqual(['always', 'needs-note'])
    })

    it('preserves registration order', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('c'))
      registry.register(cmd('a'))
      registry.register(cmd('b'))

      expect(registry.available(ctx()).map((c) => c.id)).toEqual(['c', 'a', 'b'])
    })
  })

  describe('find', () => {
    it('ranks label-startsWith above label-includes above keyword match', () => {
      const registry = new CommandRegistry()
      // Registered in reverse rank order so ranking, not registration, decides.
      registry.register(cmd('by-keyword', { label: 'Toggle sidebar', keywords: ['split'] }))
      registry.register(cmd('by-includes', { label: 'Pane split' }))
      registry.register(cmd('by-prefix', { label: 'Split pane' }))

      const ids = registry.find('split', ctx()).map((c) => c.id)
      expect(ids).toEqual(['by-prefix', 'by-includes', 'by-keyword'])
    })

    it('is case-insensitive', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('split', { label: 'Split Pane' }))

      expect(registry.find('SPLIT', ctx())).toHaveLength(1)
    })

    it('is diacritic-insensitive: "Sesion" finds "Sesión"', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('session', { label: 'Sesión de estudio' }))

      expect(registry.find('Sesion', ctx()).map((c) => c.id)).toEqual(['session'])
      // And the other direction: an accented query finds a plain label.
      registry.register(cmd('plain', { label: 'Sesion plana' }))
      expect(registry.find('sesión', ctx())).toHaveLength(2)
    })

    it('only searches available commands', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('hidden', { label: 'Close note', when: () => false }))
      registry.register(cmd('shown', { label: 'Close sidebar' }))

      expect(registry.find('close', ctx()).map((c) => c.id)).toEqual(['shown'])
    })

    it('caps results at 20', () => {
      const registry = new CommandRegistry()
      for (let i = 0; i < 25; i++) {
        registry.register(cmd(`cmd-${i}`, { label: `Note action ${i}` }))
      }

      expect(registry.find('note', ctx())).toHaveLength(20)
    })
  })

  describe('run', () => {
    it('runs an available command and returns true', async () => {
      const registry = new CommandRegistry()
      const run = vi.fn()
      registry.register(cmd('go', { run }))

      await expect(registry.run('go', ctx())).resolves.toBe(true)
      expect(run).toHaveBeenCalledOnce()
    })

    it('does NOT execute an unavailable command and returns false', async () => {
      const registry = new CommandRegistry()
      const run = vi.fn()
      registry.register(cmd('needs-note', { when: (c) => c.activeNotePath !== null, run }))

      // The palette race: the id was visible a moment ago, the note closed since.
      await expect(registry.run('needs-note', ctx())).resolves.toBe(false)
      expect(run).not.toHaveBeenCalled()
    })

    it('returns false for an unknown id', async () => {
      const registry = new CommandRegistry()
      await expect(registry.run('ghost', ctx())).resolves.toBe(false)
    })
  })

  describe('shortcuts', () => {
    it('maps shortcut to command id, skipping commands without one', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('a', { shortcut: 'Mod+P' }))
      registry.register(cmd('b'))

      expect(registry.shortcuts()).toEqual(new Map([['Mod+P', 'a']]))
    })

    it('detects collisions without remapping', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('a', { shortcut: 'Mod+P' }))
      registry.register(cmd('b', { shortcut: 'Mod+P' }))
      registry.register(cmd('c', { shortcut: 'Mod+K' }))

      expect(registry.detectCollisions()).toEqual([{ shortcut: 'Mod+P', ids: ['a', 'b'] }])
      // Detection only: both commands keep their declared shortcut untouched.
      expect(registry.get('a')?.shortcut).toBe('Mod+P')
      expect(registry.get('b')?.shortcut).toBe('Mod+P')
    })

    it('reports no collisions when every shortcut is unique', () => {
      const registry = new CommandRegistry()
      registry.register(cmd('a', { shortcut: 'Mod+P' }))
      registry.register(cmd('b', { shortcut: 'Mod+K' }))

      expect(registry.detectCollisions()).toEqual([])
    })
  })
})
