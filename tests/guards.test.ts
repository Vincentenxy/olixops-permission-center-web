import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { installGuards } from '../src/router/guards'
import { setToken } from '../src/utils/token'
import { loginDestination } from '../src/utils/redirect'
import { getProfile } from '../src/api/auth'
import { ApiError } from '../src/api/http'

vi.mock('../src/api/auth', () => ({ login: vi.fn(), getProfile: vi.fn() }))
vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))

function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: {}, meta: { title: '登录' } },
      {
        path: '/workspace',
        name: 'WorkspaceHome',
        component: {},
        meta: { requiresAuth: true, title: '我的工作空间' },
      },
      {
        path: '/workspace/users',
        name: 'Users',
        component: {},
        meta: { requiresAuth: true, platformAdmin: true, title: '管理员' },
      },
    ],
  })
  installGuards(router, createPinia())
  return router
}

describe('认证路由守卫', () => {
  it('未认证访问被引导至登录', async () => {
    const router = setup()
    await router.push('/workspace')
    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.redirect).toBe('/workspace')
  })

  it('保存的 token 必须经后端确认身份', async () => {
    setToken('fictional-token')
    vi.mocked(getProfile).mockResolvedValue({
      userId: 'test',
      username: 'test',
      name: '测试用户',
      platformRole: 'none',
    })
    const router = setup()
    await router.push('/login')
    expect(getProfile).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('WorkspaceHome')
  })

  it('后端拒绝旧 token 时回到登录而非进入工作空间', async () => {
    setToken('fictional-token')
    vi.mocked(getProfile).mockRejectedValue(new ApiError('Unauthorized', 401, 401))
    const router = setup()
    await router.push('/workspace')
    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('租户管理员不能进入平台管理员页面', async () => {
    setToken('fictional-token')
    vi.mocked(getProfile).mockResolvedValue({
      userId: 'tenant-admin',
      username: 'tenant-admin',
      name: '租户管理员',
      platformRole: 'none',
    })
    const router = setup()
    await router.push('/workspace/users')
    expect(router.currentRoute.value.name).toBe('WorkspaceHome')
  })

  it('平台超管可以进入管理员页面', async () => {
    setToken('fictional-token')
    vi.mocked(getProfile).mockResolvedValue({
      userId: 'platform-admin',
      username: 'platform-admin',
      name: '平台管理员',
      platformRole: 'platform_admin',
    })
    const router = setup()
    await router.push('/workspace/users')
    expect(router.currentRoute.value.name).toBe('Users')
  })

  it.each([
    'https://example.invalid',
    '//example.invalid',
    '/\\example.invalid',
    '/login',
    'javascript:alert(1)',
    ['https://example.invalid'],
  ])('拒绝外部或未实现的重定向 %s', (path) => {
    expect(loginDestination(path)).toBe('/workspace')
  })
})
