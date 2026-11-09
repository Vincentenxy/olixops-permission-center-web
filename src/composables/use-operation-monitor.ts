import { onBeforeUnmount, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { authorizationApi } from '../api/authorization'
import { isRequestCanceled } from '../api/http'
import type { OperationReceipt } from '../types/authorization'

export function useOperationMonitor(
  system: MaybeRefOrGetter<string>,
  operation: MaybeRefOrGetter<string>,
) {
  const receipt = shallowRef<OperationReceipt | null>(null)
  const loading = ref(false)
  const notice = ref('')
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  function stop(): void {
    generation++
    clearTimeout(timer)
    controller?.abort()
    loading.value = false
  }
  function resume(): void {
    stop()
    const systemId = toValue(system)
    const operationId = toValue(operation)
    if (!systemId || !operationId) return
    const current = generation
    const started = Date.now()
    let delay = 500
    notice.value = ''
    const poll = async (): Promise<void> => {
      controller = new AbortController()
      loading.value = true
      try {
        const next = await authorizationApi.operation(systemId, operationId, controller.signal)
        if (current !== generation) return
        receipt.value = next
        if (next.state === 'applied' || next.state === 'blocked') return
        if (Date.now() - started >= 60000) {
          notice.value = '任务仍待确认，已暂停自动查询。任务编号已保留，可继续查看。'
          return
        }
        timer = setTimeout(() => {
          void poll()
        }, delay)
        delay = Math.min(delay * 2, 5000)
      } catch (error) {
        if (current === generation && !isRequestCanceled(error)) {
          notice.value = '暂时无法读取任务状态，结果尚未确认。请继续查询，不要重新提交。'
        }
      } finally {
        if (current === generation) loading.value = false
      }
    }
    void poll()
  }
  watch(
    () => [toValue(system), toValue(operation)],
    () => {
      receipt.value = null
      notice.value = ''
      resume()
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)
  return { receipt, loading, notice, resume }
}
