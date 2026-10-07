/**
 * Vault errors, as presentation is allowed to see them.
 *
 * Screens may not import `@/lib/vault` (see `context.tsx`), but they DO need to
 * turn a refusal into a Spanish sentence. This is the seam: one function, no
 * access to the vault itself.
 */
export { vaultErrorMessage } from '@/lib/vault/error-messages'
export { vaultErrorCode, type VaultErrorCode } from '@/lib/vault/errors'
