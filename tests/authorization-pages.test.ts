import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, onMounted } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizationApi } from '../src/api/authorization'
import { ApiError } from '../src/api/http'
import RelationsPanel from '../src/components/authorization/RelationsPanel.vue'
import PermissionTestPanel from '../src/components/authorization/PermissionTestPanel.vue'
import OperationCard from '../src/components/authorization/OperationCard.vue'
import type { PermissionQuery, RelationDetail } from '../src/types/authorization'
import { dialogStub } from './helpers/dialog-stub'

vi.mock('../src/api/authorization', () => ({
  authorizationApi: {
    relations: vi.fn(),
    relation: vi.fn(),
    check: vi.fn(),
    operation: vi.fn(),
    retry: vi.fn(),
  },
}))
vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))
const query: PermissionQuery = {
  subject: { type: 'user', id: 'alice' },
  resource: { type: 'folder', id: 'one' },
  action: 'read',
}
const fields = defineComponent({
  emits: ['update:modelValue'],
  setup(_, { emit }) {
    onMounted(() => emit('update:modelValue', query))
    return () => null
  },
})
const global = {
  stubs: { PermissionFields: fields, ElDialog: dialogStub },
  directives: { loading: {} },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authorizationApi.relations).mockResolvedValue({ total: 0, list: [] })
})

describe('直接授权页面', () => {
  async function openGrant() {
    const submit = vi.fn().mockResolvedValue(null)
    const wrapper = mount(RelationsPanel, {
      props: {
        systemId: 'system-a',
        enabled: true,
        busy: false,
        writeLocked: false,
        revision: 0,
        submit,
      },
      global,
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '授予权限')!
      .trigger('click')
    await flushPromises()
    return { wrapper, submit }
  }
  it('首次声明不存在时以 expectedVersion=0 提交，使用业务引用', async () => {
    vi.mocked(authorizationApi.relation).mockRejectedValue(new ApiError('Not Found', 404, 404))
    const { wrapper, submit } = await openGrant()
    await wrapper.find('#grant-form').trigger('submit')
    await flushPromises()
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      { kind: 'grant', ...query, expectedVersion: 0 },
      'system-a',
    )
    wrapper.unmount()
  })
  it('已有声明使用关系版本，不能拿任务版本代替', async () => {
    const relation: RelationDetail = {
      relationId: 'relation-a',
      version: 7,
      desiredPresent: false,
      syncStatus: 'applied',
      lastOperationId: 'op-a',
    }
    vi.mocked(authorizationApi.relation).mockResolvedValue(relation)
    const { wrapper, submit } = await openGrant()
    await wrapper.find('#grant-form').trigger('submit')
    await flushPromises()
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      { kind: 'grant', ...query, expectedVersion: 7 },
      'system-a',
    )
    wrapper.unmount()
  })
  it('版本查询依赖失败不能当成首次授权；待生效声明也不能重提', async () => {
    vi.mocked(authorizationApi.relation).mockRejectedValue(new ApiError('服务暂时不可用', 503, 503))
    const { wrapper, submit } = await openGrant()
    await wrapper.find('#grant-form').trigger('submit')
    await flushPromises()
    expect(submit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('服务暂时不可用')
    vi.mocked(authorizationApi.relation).mockResolvedValue({
      relationId: 'r',
      version: 1,
      desiredPresent: true,
      syncStatus: 'pending',
      lastOperationId: 'op',
    })
    await wrapper.find('#grant-form').trigger('submit')
    await flushPromises()
    expect(submit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('未完成任务')
    wrapper.unmount()
  })
  it('离开页面后的迟到版本响应不再提交授权', async () => {
    let complete!: (value: RelationDetail) => void
    vi.mocked(authorizationApi.relation).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const { wrapper, submit } = await openGrant()
    await wrapper.find('#grant-form').trigger('submit')
    wrapper.unmount()
    complete({
      relationId: 'r',
      version: 1,
      desiredPresent: false,
      syncStatus: 'applied',
      lastOperationId: 'op',
    })
    await flushPromises()
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('权限测试页面', () => {
  it('故障清除旧允许结果，系统不就绪时禁止再次查询', async () => {
    vi.mocked(authorizationApi.check)
      .mockResolvedValueOnce({ allowed: true, checkedSequence: '4' })
      .mockRejectedValueOnce(new ApiError('unavailable', 503, 503))
    const wrapper = mount(PermissionTestPanel, {
      props: { systemId: 'system-a', enabled: true, revision: 0 },
      global,
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('允许访问')
    expect(authorizationApi.check).toHaveBeenLastCalledWith(
      'system-a',
      query,
      expect.any(AbortSignal),
    )
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).not.toContain('允许访问')
    expect(wrapper.text()).toContain('未得到权限判断结果')
    await wrapper.setProps({ enabled: false })
    await wrapper.find('form').trigger('submit')
    expect(authorizationApi.check).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})

describe('阻塞任务恢复', () => {
  it('恢复使用任务 version，保留原 operationId，不重新创建授权', async () => {
    const blocked = {
      operationId: 'operation-a',
      kind: 'grant' as const,
      systemId: 'system-a',
      sequence: '8',
      state: 'blocked' as const,
      version: 9,
      targetType: 'relation',
      targetId: 'relation-a',
      targetVersion: 2,
      errorReason: 'authorityChanged',
      createAt: '2026-11-10T00:00:00Z',
      appliedAt: null,
    }
    vi.mocked(authorizationApi.operation)
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce({ ...blocked, state: 'applied', version: 11 })
    vi.mocked(authorizationApi.retry).mockResolvedValue({
      ...blocked,
      state: 'queued',
      version: 10,
    })
    const wrapper = mount(OperationCard, {
      props: { systemId: 'system-a', operationId: 'operation-a' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('需要恢复')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '恢复此任务')!
      .trigger('click')
    await flushPromises()
    expect(authorizationApi.retry).toHaveBeenCalledExactlyOnceWith('system-a', 'operation-a', 9)
    expect(wrapper.text()).toContain('已生效')
    wrapper.unmount()
  })
})
