import { useBackend } from '@/lib/backends/context'

/** Whether this workspace keeps uploaded files (the backend's `resources.files` capability). */
export function useCanUploadMaterialFiles(): boolean {
  return Boolean(useBackend().resources.files)
}
