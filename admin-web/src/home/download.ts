export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Delay revocation until Safari has consumed the download URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
