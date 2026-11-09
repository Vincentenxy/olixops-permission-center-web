import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizationApi } from '../src/api/authorization'
import { ApiError } from '../src/api/http'
import { useAuthorizationCommand } from '../src/composables/use-authorization-command'
import { useOperationMonitor } from '../src/composables/use-operation-monitor'
import { usePagedList } from '../src/composables/use-paged-list'
import { usePagedOptions } from '../src/composables/use-paged-options'
import type { OperationReceipt, OperationState } from '../src/types/authorization'

vi.mock('../src/api/authorization', () => ({
  authorizationApi: { submit: vi.fn(), operation: vi.fn() },
}))
vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))
function receipt(state: OperationState = 'queued'): OperationReceipt {
  return {
    operationId: 'op-1',
    kind: 'initialize',
    systemId: 'system-a',
    sequence: '1',
    state,
    version: 1,
    targetType: 'system',
    targetId: 'system-a',
    targetVersion: 1,
    errorReason: '',
    createAt: '2026-11-10T00:00:00Z',
    appliedAt: null,
  }
}
function harness<T>(factory: () => T) {
  let state!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        state = factory()
        return () => null
      },
    }),
  )
  return { state, wrapper }
}
beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('授权写入的幂等与会话范围', () => {
  it('超时与重新进入页面后，复用原始键和不可变命令，不重新授权', async () => {
    vi.mocked(authorizationApi.submit).mockRejectedValueOnce(new ApiError('timeout', 504, 504))
    const first = harness(() => useAuthorizationCommand('user-a', 'system-a'))
    await first.state.send({ kind: 'initialize' })
    const key = first.state.intent.value?.idempotencyKey
    expect(key).toBeTruthy()
    first.wrapper.unmount()
    const next = harness(() => useAuthorizationCommand('user-a', 'system-a'))
    vi.mocked(authorizationApi.submit).mockResolvedValueOnce(receipt())
    const result = await next.state.send({
      kind: 'register_type',
      code: 'changed',
      name: '不能覆盖原操作',
    })
    expect(authorizationApi.submit).toHaveBeenLastCalledWith('system-a', key, {
      kind: 'initialize',
    })
    expect(result?.operationId).toBe('op-1')
    expect(next.state.intent.value).toBeNull()
    next.wrapper.unmount()
  })
  it('提交中不重复发起；切换系统后迟到的收据不能影响新范围', async () => {
    let resolve!: (value: OperationReceipt) => void
    vi.mocked(authorizationApi.submit).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const system = ref('system-a')
    const { state, wrapper } = harness(() => useAuthorizationCommand('user-a', system))
    const pending = state.send({ kind: 'initialize' })
    expect(await state.send({ kind: 'initialize' })).toBeNull()
    system.value = 'system-b'
    await flushPromises()
    resolve(receipt())
    expect(await pending).toBeNull()
    expect(state.intent.value).toBeNull()
    expect(authorizationApi.submit).toHaveBeenCalledTimes(1)
    system.value = 'system-a'
    await flushPromises()
    expect(state.intent.value?.command.kind).toBe('initialize')
    wrapper.unmount()
    expect(await state.send()).toBeNull()
  })
  it('明确拒绝可修正输入，其他账号不读取该账号的未确认操作', async () => {
    vi.mocked(authorizationApi.submit).mockRejectedValueOnce(new ApiError('conflict', 409, 409))
    const { state, wrapper } = harness(() => useAuthorizationCommand('user-a', 'system-a'))
    await state.send({ kind: 'initialize' })
    expect(state.intent.value).toBeNull()
    vi.mocked(authorizationApi.submit).mockRejectedValueOnce(new ApiError('offline', -1, 0))
    await state.send({ kind: 'initialize' })
    wrapper.unmount()
    const other = harness(() => useAuthorizationCommand('user-b', 'system-a'))
    expect(other.state.intent.value).toBeNull()
    other.wrapper.unmount()
  })
})

describe('任务轮询', () => {
  it('待执行与执行中不视为生效，applied 后停止轮询', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.mocked(authorizationApi.operation)
      .mockResolvedValueOnce(receipt())
      .mockResolvedValueOnce(receipt('running'))
      .mockResolvedValueOnce(receipt('applied'))
    const { state, wrapper } = harness(() => useOperationMonitor('system-a', 'op-1'))
    await flushPromises()
    expect(state.receipt.value?.state).toBe('queued')
    await vi.advanceTimersByTimeAsync(500)
    expect(state.receipt.value?.state).toBe('running')
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.receipt.value?.state).toBe('applied')
    await vi.advanceTimersByTimeAsync(10000)
    expect(authorizationApi.operation).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })
  it('阻塞停止自动查询；读取失败保留任务编号并允许继续查询', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.mocked(authorizationApi.operation)
      .mockRejectedValueOnce(new ApiError('offline', -1, 0))
      .mockResolvedValueOnce(receipt('blocked'))
    const { state, wrapper } = harness(() => useOperationMonitor('system-a', 'op-1'))
    await flushPromises()
    expect(state.notice.value).toContain('结果尚未确认')
    state.resume()
    await flushPromises()
    expect(state.receipt.value?.state).toBe('blocked')
    await vi.advanceTimersByTimeAsync(10000)
    expect(authorizationApi.operation).toHaveBeenCalledTimes(2)
    expect(authorizationApi.operation).toHaveBeenLastCalledWith(
      'system-a',
      'op-1',
      expect.any(AbortSignal),
    )
    wrapper.unmount()
  })
  it('等待预算耗尽不重发写入，离开页面取消未完成读取', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.mocked(authorizationApi.operation).mockResolvedValue(receipt('retry_wait'))
    const { state, wrapper } = harness(() => useOperationMonitor('system-a', 'op-1'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(65000)
    expect(state.notice.value).toContain('暂停自动查询')
    const count = vi.mocked(authorizationApi.operation).mock.calls.length
    await vi.advanceTimersByTimeAsync(20000)
    expect(authorizationApi.operation).toHaveBeenCalledTimes(count)
    expect(authorizationApi.submit).not.toHaveBeenCalled()
    wrapper.unmount()
    const signal = vi.mocked(authorizationApi.operation).mock.calls.at(-1)?.[2]
    expect(signal?.aborted).toBe(true)
  })
})

describe('分页范围与选项', () => {
  it('清空范围后，旧列表响应不能带回上个系统的数据', async () => {
    let complete!: (value: { total: number; list: string[] }) => void
    const loader = vi.fn(
      () =>
        new Promise<{ total: number; list: string[] }>((resolve) => {
          complete = resolve
        }),
    )
    const { state, wrapper } = harness(() => usePagedList(loader))
    const loading = state.load()
    state.clear()
    complete({ total: 1, list: ['system-a-secret'] })
    await loading
    expect(state.list.value).toEqual([])
    expect(state.total.value).toBe(0)
    wrapper.unmount()
  })
  it('远程选项可追加后续页，搜索失败与空列表区分', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ total: 2, list: ['one'] })
      .mockResolvedValueOnce({ total: 2, list: ['two'] })
      .mockRejectedValueOnce(new Error('offline'))
    const { state, wrapper } = harness(() => usePagedOptions<string>(loader))
    await state.load()
    await state.load(true)
    expect(state.items.value).toEqual(['one', 'two'])
    state.search('missing')
    await flushPromises()
    expect(state.failed.value).toBe(true)
    expect(state.items.value).toEqual([])
    expect(loader).toHaveBeenLastCalledWith('missing', 1, expect.any(AbortSignal))
    wrapper.unmount()
  })
})
