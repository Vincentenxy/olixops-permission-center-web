import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'
import { managementApi } from '../src/api/management'
import { http } from '../src/api/http'

function requestBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  return typeof config.data === 'string'
    ? (JSON.parse(config.data) as Record<string, unknown>)
    : (config.data as Record<string, unknown>)
}

function respondWith(
  assertion: (config: InternalAxiosRequestConfig) => void,
  data: unknown,
): AxiosAdapter {
  return async (config) => {
    assertion(config)
    return {
      data: { code: 0, msg: '', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
}

describe('管理接口契约', () => {
  beforeEach(() => {
    http.defaults.adapter = undefined
  })

  it('租户列表使用标准分页入参', async () => {
    http.defaults.adapter = respondWith(
      (config) => {
        expect(config.method).toBe('post')
        expect(config.url).toBe('/tenant/list')
        expect(requestBody(config)).toEqual({
          code: 'finance',
          name: '',
          status: 'active',
          pageNum: 2,
          pageSize: 50,
        })
      },
      { total: 0, list: [] },
    )

    await expect(
      managementApi.listTenants({
        code: 'finance',
        name: '',
        status: 'active',
        pageNum: 2,
        pageSize: 50,
      }),
    ).resolves.toEqual({ total: 0, list: [] })
  })

  it('实际租户管理范围使用独立身份接口', async () => {
    http.defaults.adapter = respondWith(
      (config) => {
        expect(config.url).toBe('/auth/tenant/list')
        expect(requestBody(config)).toEqual({ name: '研发', pageNum: 1, pageSize: 20 })
      },
      { total: 1, list: [{ id: 'tenant-id', name: '研发' }] },
    )

    const result = await managementApi.listMyTenants({ name: '研发', pageNum: 1, pageSize: 20 })
    expect(result.total).toBe(1)
  })

  it('创建 Token 前查询后端实时签发资格', async () => {
    http.defaults.adapter = respondWith(
      (config) => {
        expect(config.url).toBe('/system/credential/checkCreate')
        expect(requestBody(config)).toEqual({ systemId: 'system-id' })
      },
      { allowed: false, reason: 'tenantAdminRequired' },
    )

    await expect(managementApi.checkCredentialCreation('system-id')).resolves.toEqual({
      allowed: false,
      reason: 'tenantAdminRequired',
    })
  })

  it('创建系统 Token 只提交账号和名称', async () => {
    http.defaults.adapter = respondWith(
      (config) => {
        expect(config.url).toBe('/system/credential/create')
        expect(requestBody(config)).toEqual({ accountId: 'account-id', name: 'production' })
      },
      {
        credential: { id: 'credential-id', keyId: 'key-id', status: 'active' },
        token: 'one-time-token',
      },
    )

    const result = await managementApi.createCredential('account-id', 'production')
    expect(result.token).toBe('one-time-token')
  })

  it('吊销系统 Token 带上乐观锁版本', async () => {
    http.defaults.adapter = respondWith(
      (config) => {
        expect(config.url).toBe('/system/credential/revoke')
        expect(requestBody(config)).toEqual({ id: 'credential-id', version: 3 })
      },
      { id: 'credential-id', status: 'revoked', version: 4 },
    )

    await managementApi.revokeCredential('credential-id', 3)
  })
})
