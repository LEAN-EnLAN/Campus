/**
 * Hand the student a file made in the page: a Blob behind a temporary link.
 *
 * Nothing goes through a server. On the web the browser saves it as usual;
 * in the desktop shell WebView2 runs its own download flow (the shell does not
 * register a download handler, so the default "Descargas" bar applies).
 */
export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next task: revoking synchronously can cancel the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
