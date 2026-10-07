import { useEffect } from 'react'

/** Set the tab title for as long as the calling screen is mounted. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
