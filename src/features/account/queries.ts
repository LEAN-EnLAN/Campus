import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { useBackend } from '@/lib/backends/context'
import type { AccountProfile, CampusBackend, SendFeedbackInput } from '@/lib/backends/types'
import { queryKeys } from '@/lib/query-keys'

type ProfileCapability = NonNullable<CampusBackend['profile']>

/** One definition, shared by the settings screen and by `track()`'s consent check. */
export function accountProfileQuery(profile: ProfileCapability) {
  return {
    queryKey: queryKeys.accountProfile,
    queryFn: (): Promise<AccountProfile> => profile.get(),
  }
}

/** Current consent, from the cache when fresh. Used by the telemetry bridge. */
export async function readMetricsConsent(
  queryClient: QueryClient,
  profile: ProfileCapability,
): Promise<boolean> {
  const current = await queryClient.fetchQuery({
    ...accountProfileQuery(profile),
    staleTime: 30_000,
  })
  return current.metricsConsent
}

/** Absent capability (Local) → the query never runs and `data` stays undefined. */
export function useAccountProfile() {
  const { profile } = useBackend()
  return useQuery({
    ...accountProfileQuery(profile ?? noProfile),
    enabled: Boolean(profile),
  })
}

const noProfile: ProfileCapability = {
  get: () => Promise.reject(new Error('Este espacio de trabajo no tiene cuenta')),
  setMetricsConsent: () => Promise.reject(new Error('Este espacio de trabajo no tiene cuenta')),
}

export function useSetMetricsConsent() {
  const queryClient = useQueryClient()
  const { profile } = useBackend()

  return useMutation({
    mutationFn: (consent: boolean) => (profile ?? noProfile).setMetricsConsent(consent),
    // Write the cache first: `track()` reads it, and switching consent off has
    // to stop the very next event, not the one after the round trip.
    onMutate: async (consent) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accountProfile })
      const previous = queryClient.getQueryData<AccountProfile>(queryKeys.accountProfile)
      queryClient.setQueryData<AccountProfile>(queryKeys.accountProfile, {
        metricsConsent: consent,
        metricsConsentAt: consent ? new Date().toISOString() : null,
      })
      return { previous }
    },
    onError: (_error, _consent, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.accountProfile, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accountProfile })
    },
  })
}

export function useDeleteAccount() {
  const { account } = useBackend()
  return useMutation({
    mutationFn: () =>
      account ? account.delete() : Promise.reject(new Error('Este espacio no tiene cuenta')),
  })
}

export function useSendFeedback() {
  const { feedback } = useBackend()
  return useMutation({
    mutationFn: (input: SendFeedbackInput) =>
      feedback
        ? feedback.send(input)
        : Promise.reject(new Error('Este espacio no tiene cuenta')),
  })
}
