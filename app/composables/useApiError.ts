/** Shows an API error as a toast. Returns a handler usable in `catch`. */
export function useApiError() {
  const toast = useToast()
  return (err: unknown, fallback = 'Algo ha ido mal') => {
    const e = err as { data?: { statusMessage?: string, message?: string }, statusMessage?: string }
    toast.add({
      title: e?.data?.statusMessage || e?.statusMessage || fallback,
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
}
