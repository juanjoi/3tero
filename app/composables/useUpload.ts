/**
 * Multipart upload with progress (XHR: fetch has no upload progress).
 * Resolves with the parsed JSON response, rejects with `{ statusCode, data }` like $fetch.
 */
export function useUpload() {
  const progress = ref(0)
  const uploading = ref(false)

  function upload<T>(url: string, files: File[], fields: Record<string, string> = {}): Promise<T> {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.append(k, v)
    for (const f of files) body.append('file', f, f.name)

    uploading.value = true
    progress.value = 0
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100)
      }
      xhr.onload = () => {
        uploading.value = false
        let data: any = null
        try { data = JSON.parse(xhr.responseText) }
        catch { /* not JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data as T)
        else reject({ statusCode: xhr.status, data })
      }
      xhr.onerror = () => {
        uploading.value = false
        reject({ statusCode: 0, data: { statusMessage: 'Error de red durante la subida' } })
      }
      xhr.send(body)
    })
  }

  return { upload, progress, uploading }
}
