import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import LoginView from '../src/views/LoginView.vue'
import { login } from '../src/api/auth'
import { ApiError } from '../src/api/http'
import { useAuthStore } from '../src/stores/auth'
import type { LoginResponse } from '../src/types/auth'

vi.mock('../src/api/auth', () => ({ login: vi.fn(), getProfile: vi.fn() }))
vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))

const response: LoginResponse = {
  accessToken: 'fictional-token',
  expiresAt: '2099-01-01T00:00:00Z',
  user: {
    userId: 'test-user',
    username: 'demo.admin',
    name: '测试管理员',
    platformRole: 'platform_admin',
  },
}

async function setup(path = '/login') {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: LoginView },
      { path: '/workspace', component: { template: '<div>workspace</div>' } },
    ],
  })
  await router.push(path)
  const wrapper = mount(LoginView, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  })
  return { wrapper, router, auth: useAuthStore(pinia) }
}

describe('登录页面', () => {
  it('空表单内联校验，不发送请求并聚焦账号', async () => {
    const { wrapper } = await setup()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入账号。')
    expect(wrapper.text()).toContain('请输入密码。')
    expect(login).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('username')
    wrapper.unmount()
  })

  it('密码按钮可访问且不会提交表单', async () => {
    const { wrapper } = await setup()
    const button = wrapper.find('[aria-label="显示密码"]')
    await button.trigger('click')
    expect(wrapper.find('#password').attributes('type')).toBe('text')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('隐藏密码')
    expect(login).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('登录失败内联展示、恢复按钮并保留输入', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError('Unauthorized', 401, 401))
    const { wrapper, router } = await setup()
    await wrapper.find('#username').setValue('demo.admin')
    await wrapper.find('#password').setValue('fictional-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('账号或密码不正确，请重新输入。')
    expect(wrapper.find('.login-submit').attributes('disabled')).toBeUndefined()
    expect((wrapper.find('#username').element as HTMLInputElement).value).toBe('demo.admin')
    expect(router.currentRoute.value.path).toBe('/login')
    wrapper.unmount()
  })

  it('网络失败通过内联错误展示', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError('网络连接失败，请检查网络后重试。', -1, 0))
    const { wrapper } = await setup()
    await wrapper.find('#username').setValue('demo.admin')
    await wrapper.find('#password').setValue('fictional-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('网络连接失败')
    expect(wrapper.find('form').attributes('aria-busy')).toBe('false')
    wrapper.unmount()
  })

  it('提交中禁用重复提交，成功后进入内部页面并清理密码', async () => {
    let complete: ((value: LoginResponse) => void) | undefined
    vi.mocked(login).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const { wrapper, router, auth } = await setup('/login?redirect=https://example.invalid')
    await wrapper.find('#username').setValue(' demo.admin ')
    await wrapper.find('#password').setValue(' fictional-password ')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')
    expect(login).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith(
      { username: 'demo.admin', password: ' fictional-password ' },
      expect.any(AbortSignal),
    )
    expect(wrapper.find('.login-submit').attributes('disabled')).toBeDefined()
    expect(wrapper.find('#password').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('正在登录')
    complete?.(response)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/workspace')
    expect((wrapper.find('#password').element as HTMLInputElement).value).toBe('')
    expect(auth.authenticated).toBe(true)
    wrapper.unmount()
  })

  it('离开登录页面会取消尚未结束的登录', async () => {
    let complete: ((value: LoginResponse) => void) | undefined
    vi.mocked(login).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const { wrapper, auth } = await setup()
    await wrapper.find('#username').setValue('demo.admin')
    await wrapper.find('#password').setValue('fictional-password')
    await wrapper.find('form').trigger('submit')
    wrapper.unmount()
    complete?.(response)
    await flushPromises()
    expect(auth.authenticated).toBe(false)
  })
})
