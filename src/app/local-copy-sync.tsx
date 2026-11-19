import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useAuth } from '@/features/auth/auth-context'
import { mirrorFiles, readMirrorSnapshot, writeMirror } from '@/lib/runtime/cloud-mirror'
import { useRuntime } from '@/lib/runtime/context'
import { readDeviceConfig, setLocalCopy, writeDeviceConfig } from '@/lib/runtime/device-config'
import { LocalCopyContext, type LocalCopyValue } from '@/lib/runtime/local-copy'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import { vaultErrorMessage } from '@/lib/vault/error-messages'
import type { VaultAccess } from '@/lib/vault/vault-access'

import { suggestCopyFolder } from './default-folder'

/** Changes come in bursts (a plan edit marks several subjects): copy once after. */
const DEBOUNCE_MS = 2000

/**
 * Keeps this device's local copy of the CLOUD workspace up to date: once when
 * the workspace opens, and after every successful change (debounced). One way
 * only — see `cloud-mirror.ts`.
 *
 * Lives in the composition root because it is the one place that may know the
 * workspace is the cloud and that this machine also has folders.
 */
export function LocalCopySync({
  capabilities,
  children,
}: {
  capabilities: RuntimeCapabilities
  children: ReactNode
}) {
  const { state } = useRuntime()
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const cloud =
    state.status === 'ready' && state.runtime.mode === 'cloud' ? state.runtime : null
  const openCopyFolder = capabilities.vaultAvailable ? capabilities.openCopyFolder : undefined
  const available = Boolean(cloud && openCopyFolder)
  const signedIn = session !== null
  const email = session?.user.email ?? null

  const [choice, setChoice] = useState(
    () => readDeviceConfig(capabilities.store).localCopy ?? null,
  )
  const [status, setStatus] = useState<LocalCopyValue['status']>('idle')
  const [lastCopiedAt, setLastCopiedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const folderAccess = useRef<{ path: string; access: VaultAccess } | null>(null)

  const remember = useCallback(
    (next: { enabled: boolean; path: string | null }) => {
      writeDeviceConfig(
        capabilities.store,
        setLocalCopy(readDeviceConfig(capabilities.store), next),
      )
      setChoice(next)
    },
    [capabilities.store],
  )

  const copyTo = useCallback(
    async (path: string) => {
      if (!cloud || !openCopyFolder) return
      setStatus('copying')
      setError(null)
      try {
        if (folderAccess.current?.path !== path) {
          folderAccess.current = { path, access: await openCopyFolder(path) }
        }
        const now = new Date()
        const snapshot = await readMirrorSnapshot(cloud.backend, email, now)
        await writeMirror(folderAccess.current.access, mirrorFiles(snapshot))
        setLastCopiedAt(now)
        setStatus('copied')
      } catch (cause) {
        folderAccess.current = null
        setError(vaultErrorMessage(cause))
        setStatus('error')
      }
    },
    [cloud, openCopyFolder, email],
  )

  const active = available && signedIn && choice?.enabled === true && choice.path !== null
  const activePath = active ? choice.path : null

  // On start, and whenever the workspace or the folder changes.
  useEffect(() => {
    if (activePath) void copyTo(activePath)
  }, [activePath, copyTo])

  // After every change that reached the cloud.
  useEffect(() => {
    if (!activePath) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void copyTo(activePath), DEBOUNCE_MS)
    })
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [activePath, queryClient, copyTo])

  const enable = useCallback(
    async (folder?: string) => {
      if (!openCopyFolder) return
      let path = folder ?? choice?.path ?? null
      if (!path && capabilities.listFolders) {
        try {
          path = suggestCopyFolder(await capabilities.listFolders()).path
        } catch (cause) {
          setError(vaultErrorMessage(cause))
          setStatus('error')
          return
        }
      }
      if (!path) return
      remember({ enabled: true, path })
    },
    [openCopyFolder, choice, capabilities, remember],
  )

  const disable = useCallback(() => {
    remember({ enabled: false, path: choice?.path ?? null })
    setStatus('idle')
  }, [remember, choice])

  const copyNow = useCallback(async () => {
    if (activePath) await copyTo(activePath)
  }, [activePath, copyTo])

  const value = useMemo<LocalCopyValue | null>(
    () =>
      available
        ? {
            enabled: choice ? choice.enabled : null,
            folder: choice?.path ?? null,
            shouldAsk: signedIn && choice === null,
            status,
            lastCopiedAt,
            error,
            enable,
            disable,
            copyNow,
          }
        : null,
    [available, choice, signedIn, status, lastCopiedAt, error, enable, disable, copyNow],
  )

  return <LocalCopyContext value={value}>{children}</LocalCopyContext>
}
