import { onBeforeUnmount, ref, type Ref } from 'vue'
import { isRequestCanceled } from '../api/http'
import type { PageResp } from '../types/api'

export interface PagedList<T> {
  list: Ref<T[]>
  total: Ref<number>
  pageNum: Ref<number>
  pageSize: Ref<number>
  loading: Ref<boolean>
  load: (reset?: boolean) => Promise<void>
  changePage: (page: number) => Promise<void>
  changePageSize: (size: number) => Promise<void>
}

export function usePagedList<T>(
  loader: (pageNum: number, pageSize: number, signal: AbortSignal) => Promise<PageResp<T>>,
): PagedList<T> {
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(20)
  const loading = ref(false)
  let generation = 0
  let controller: AbortController | undefined

  async function load(reset = false): Promise<void> {
    if (reset) pageNum.value = 1
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    try {
      const result = await loader(pageNum.value, pageSize.value, controller.signal)
      if (current !== generation) return
      list.value = Array.isArray(result.list) ? result.list : []
      total.value = result.total
      if (list.value.length === 0 && total.value > 0 && pageNum.value > 1) {
        pageNum.value--
        await load()
      }
    } catch (error) {
      if (isRequestCanceled(error)) return
      // The shared HTTP layer owns user-facing errors; keep the last valid page visible.
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function changePage(page: number): Promise<void> {
    pageNum.value = page
    await load()
  }

  async function changePageSize(size: number): Promise<void> {
    pageSize.value = size
    await load(true)
  }

  onBeforeUnmount(() => controller?.abort())
  return { list, total, pageNum, pageSize, loading, load, changePage, changePageSize }
}
