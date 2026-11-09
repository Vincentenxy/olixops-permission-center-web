import { onBeforeUnmount, ref, type Ref } from 'vue'
import { isRequestCanceled } from '../api/http'
import type { PageResp } from '../types/api'

export function usePagedOptions<T>(
  loader: (query: string, page: number, signal: AbortSignal) => Promise<PageResp<T>>,
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const failed = ref(false)
  const total = ref(0)
  let query = ''
  let page = 1
  let generation = 0
  let controller: AbortController | undefined
  async function load(more = false): Promise<void> {
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    failed.value = false
    const next = more ? page + 1 : 1
    try {
      const result = await loader(query, next, controller.signal)
      if (current !== generation) return
      items.value = more ? [...items.value, ...result.list] : result.list
      total.value = result.total
      page = next
    } catch (error) {
      if (current === generation && !isRequestCanceled(error)) failed.value = true
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function search(value: string): void {
    clear()
    query = value
    void load()
  }
  function clear(): void {
    generation++
    controller?.abort()
    items.value = []
    total.value = 0
    query = ''
    page = 1
    loading.value = false
    failed.value = false
  }
  onBeforeUnmount(clear)
  return { items, total, loading, failed, load, search, clear }
}
