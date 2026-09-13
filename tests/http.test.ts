import { AxiosError, CanceledError, type AxiosAdapter } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, get, http } from '../src/api/http'
import { getToken, onSessionInvalidated, setToken } from '../src/utils/token'
import { notify } from '../src/utils/notify'

vi.mock('../src/utils/notify', () => ({ notify: { error: vi.fn() } }))

function respond(data: unknown, status = 200): AxiosAdapter {
  return async (config) => {
    const response = {
      data,
      status,
      statusText: 'test',
      headers: { 'x-request-id': 'test-request' },
      config,
    }
    if (status >= 400) throw new AxiosError('test', 'ERR_BAD_RESPONSE', config, undefined, response)
    return response
  }
}

describe('统一请求层', () => {
  beforeEach(() => {
    http.defaults.adapter = respond({ code: 0, msg: '', data: { value: 1 } })
  })

  it('解包成功结果并携带当前认证和请求 ID', async () => {
    setToken('fictional-token')
    http.defaults.adapter = async (config) => {
      expect(config.headers.get('Authorization')).toBe('Bearer fictional-token')
      expect(config.headers.get('x-request-id')).toBeTruthy()
      return {
        data: { code: 0, msg: '', data: { value: 1 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    expect(await get('/auth/me')).toEqual({ value: 1 })
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('登录请求不附加旧账号凭证', async () => {
    setToken('old-fictional-token')
    http.defaults.adapter = async (config) => {
      expect(config.headers.has('Authorization')).toBe(false)
      return {
        data: { code: 0, msg: '', data: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    await get('/pub/auth/login', { requiresAuth: false })
  })

  it('普通业务错误仅提示一次并保留请求 ID', async () => {
    http.defaults.adapter = respond({ code: -1, msg: 'tenant code already exists', data: null })
    await expect(get('/tenant/list')).rejects.toMatchObject({ code: -1, requestId: 'test-request' })
    expect(notify.error).toHaveBeenCalledExactlyOnceWith('tenant code already exists')
  })

  it('silent 保留错误但不弹出提示', async () => {
    http.defaults.adapter = respond({ code: -1, msg: 'operation failed', data: null })
    await expect(get('/test', { silent: true })).rejects.toBeInstanceOf(ApiError)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('网关错误不当作业务错误且只提示一次', async () => {
    http.defaults.adapter = respond('<html>Bad Gateway</html>', 502)
    await expect(get('/test')).rejects.toMatchObject({ status: 502 })
    expect(notify.error).toHaveBeenCalledTimes(1)
  })

  it('非标准成功内容报告协议错误', async () => {
    http.defaults.adapter = respond('<html>Login</html>')
    await expect(get('/test')).rejects.toMatchObject({ message: '服务返回了无法识别的内容。' })
    expect(notify.error).toHaveBeenCalledTimes(1)
  })

  it('protected 401 即使 silent 也清理会话并通知认证层', async () => {
    const expired = vi.fn()
    setToken('fictional-token')
    onSessionInvalidated(expired)
    http.defaults.adapter = respond({ code: 401, msg: 'Unauthorized', data: null }, 401)
    await expect(get('/auth/me', { silent: true })).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBe('')
    expect(expired).toHaveBeenCalledTimes(1)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('登录密码错误不会触发认证失效跳转', async () => {
    const expired = vi.fn()
    onSessionInvalidated(expired)
    http.defaults.adapter = respond({}, 401)
    await expect(
      get('/pub/auth/login', { requiresAuth: false, silent: true }),
    ).rejects.toMatchObject({ status: 401 })
    expect(expired).not.toHaveBeenCalled()
  })

  it('上一会话的迟到 401 不退出新登录', async () => {
    const expired = vi.fn()
    setToken('old-token')
    onSessionInvalidated(expired)
    http.defaults.adapter = async (config) => {
      setToken('new-token')
      return respond({}, 401)(config)
    }
    await expect(get('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBe('new-token')
    expect(expired).not.toHaveBeenCalled()
  })

  it('网络错误和取消请求不会产生重复提示', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('offline', 'ERR_NETWORK', config)
    }
    await expect(get('/test')).rejects.toMatchObject({ status: 0 })
    expect(notify.error).toHaveBeenCalledTimes(1)
    vi.mocked(notify.error).mockClear()
    http.defaults.adapter = async () => {
      throw new CanceledError()
    }
    await expect(get('/test')).rejects.toBeInstanceOf(CanceledError)
    expect(notify.error).not.toHaveBeenCalled()
  })
})
