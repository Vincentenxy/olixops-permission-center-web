import { describe, expect, it, vi } from 'vitest'
import { getProfile, login } from '../src/api/auth'
import { http } from '../src/api/http'
import { notify } from '../src/utils/notify'

vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))

function respond(data: unknown): void {
  http.defaults.adapter = async (config) => ({
    data: { code: 0, msg: '', data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}

describe('认证契约', () => {
  it('登录拒绝缺少身份的成功响应', async () => {
    respond({ accessToken: 'fictional-token', expiresAt: '2099-01-01T00:00:00Z' })
    await expect(login({ username: 'test', password: 'fictional-password' })).rejects.toMatchObject(
      { code: -1 },
    )
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('拒绝由未知角色组成的身份', async () => {
    respond({
      userId: 'test-user',
      username: 'test',
      name: '测试用户',
      platformRole: 'tenant_admin',
    })
    await expect(getProfile()).rejects.toMatchObject({ code: -1 })
  })

  it('保留后端实际角色，不推断租户管理身份', async () => {
    const user = { userId: 'test-user', username: 'test', name: '测试用户', platformRole: 'none' }
    respond(user)
    expect(await getProfile()).toEqual(user)
  })
})
