import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProfile, login } from '../src/api/auth'
import { ApiError } from '../src/api/http'
import { useAuthStore } from '../src/stores/auth'
import { getToken, setToken } from '../src/utils/token'
import type { LoginResponse } from '../src/types/auth'

vi.mock('../src/api/auth', () => ({ login: vi.fn(), getProfile: vi.fn() }))
vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))

const user = {
  userId: 'fictional-user-id',
  username: 'demo.admin',
  name: '测试管理员',
  platformRole: 'platform_admin' as const,
}
const response = { user, accessToken: 'fictional-access-token', expiresAt: '2099-01-01T00:00:00Z' }

describe('认证会话', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('登录后保存 token 和后端身份，退出后全部清理', async () => {
    vi.mocked(login).mockResolvedValue(response)
    const auth = useAuthStore()
    await auth.login({ username: 'demo.admin', password: 'fictional-password' })
    expect(auth.authenticated).toBe(true)
    expect(auth.user).toEqual(user)
    expect(getToken()).toBe('fictional-access-token')
    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(0)
    auth.logout()
    expect(auth.user).toBeNull()
    expect(auth.authenticated).toBe(false)
    expect(getToken()).toBe('')
    expect(sessionStorage.length).toBe(0)
  })

  it('重载时重新验证身份且合并并发恢复请求', async () => {
    setToken('fictional-saved-token')
    vi.mocked(getProfile).mockResolvedValue(user)
    const auth = useAuthStore()
    await Promise.all([auth.restore(), auth.restore()])
    expect(getProfile).toHaveBeenCalledTimes(1)
    expect(auth.user).toEqual(user)
    expect(auth.loading).toBe(false)
  })

  it('不可用时保留 token 展示重试，重试可恢复身份', async () => {
    setToken('fictional-saved-token')
    vi.mocked(getProfile)
      .mockRejectedValueOnce(new ApiError('服务暂时不可用。', 503, 503))
      .mockResolvedValueOnce(user)
    const auth = useAuthStore()
    await auth.restore()
    expect(auth.sessionError).toBe('服务暂时不可用。')
    expect(auth.authenticated).toBe(false)
    expect(auth.token).toBe('fictional-saved-token')
    await auth.restore()
    expect(auth.user).toEqual(user)
    expect(auth.sessionError).toBe('')
  })

  it('失效会话清空本地状态', async () => {
    setToken('expired-fictional-token')
    vi.mocked(getProfile).mockRejectedValue(new ApiError('Unauthorized', 401, 401))
    const auth = useAuthStore()
    await auth.restore()
    expect(auth.token).toBe('')
    expect(auth.user).toBeNull()
    expect(auth.loading).toBe(false)
  })

  it('退出会取消请求，迟到登录结果无法重新建立会话', async () => {
    let complete: ((response: LoginResponse) => void) | undefined
    vi.mocked(login).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const auth = useAuthStore()
    const pending = auth.login({ username: 'demo.admin', password: 'fictional-password' })
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    const signal = vi.mocked(login).mock.calls[0]?.[1]
    auth.logout()
    expect(signal?.aborted).toBe(true)
    complete?.(response)
    await rejected
    expect(auth.authenticated).toBe(false)
    expect(getToken()).toBe('')
  })

  it('迟到用户信息不会恢复已退出的账号', async () => {
    setToken('fictional-saved-token')
    let complete: ((value: typeof user) => void) | undefined
    vi.mocked(getProfile).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const auth = useAuthStore()
    const pending = auth.restore()
    auth.logout()
    complete?.(user)
    await pending
    expect(auth.user).toBeNull()
    expect(auth.loading).toBe(false)
  })
})
