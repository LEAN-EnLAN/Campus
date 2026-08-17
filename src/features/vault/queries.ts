import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useFiles, type FilesAccess } from '@/lib/files/context'

/**
 * TanStack Query over the files capability.
 *
 * Directory listings are cached per path and invalidated by the mutation that
 * touched them — the same discipline the academic queries follow. Note BODIES
 * are deliberately NOT cached here: the editor owns its document lifecycle
 * (mtime, autosave, conflicts), and a query cache holding a second copy of the
 * text would be a second source of truth that drifts.
 */

export const vaultKeys = {
  dir: (path: string) => ['vault', 'dir', path] as const,
  allDirs: ['vault', 'dir'] as const,
}

export function useVaultDir(path: string) {
  const files = useFiles()
  return useQuery({
    queryKey: vaultKeys.dir(path),
    enabled: files !== null,
    queryFn: () => (files as FilesAccess).listDir(path),
  })
}

const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut)
}

/** Every filesystem mutation the explorer offers, each invalidating what it touched. */
export function useVaultMutations() {
  const files = useFiles()
  const client = useQueryClient()

  const invalidateDir = (path: string) =>
    client.invalidateQueries({ queryKey: vaultKeys.dir(parentOf(path)) })

  return {
    createNote: useMutation({
      mutationFn: async ({ path, contents = '' }: { path: string; contents?: string }) => {
        // null mtime = "I believe this is new" — an existing file is a typed
        // conflict, never an overwrite.
        await (files as FilesAccess).writeNote(path, contents, null)
        return path
      },
      onSuccess: (path) => void invalidateDir(path),
    }),

    createFolder: useMutation({
      mutationFn: async (path: string) => {
        await (files as FilesAccess).mkdir(path)
        return path
      },
      onSuccess: (path) => void invalidateDir(path),
    }),

    rename: useMutation({
      mutationFn: async ({ from, to }: { from: string; to: string }) => {
        await (files as FilesAccess).rename(from, to)
        return { from, to }
      },
      onSuccess: ({ from, to }) => {
        void invalidateDir(from)
        void invalidateDir(to)
      },
    }),

    trash: useMutation({
      mutationFn: async (path: string) => {
        const result = await (files as FilesAccess).trash(path)
        return { path, ...result }
      },
      onSuccess: ({ path }) => void invalidateDir(path),
    }),
  }
}
