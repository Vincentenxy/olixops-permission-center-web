import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types/api'
import { getToken, invalidateSession } from '../utils/token'
import { notify } from '../utils/notify'

declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean
    requiresAuth?: boolean
    sessionToken?: string
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly status: number,
    readonly requestId = '',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const statusMessages: Record<number, string> = {
  400: '请求内容不正确，请检查后重试。',
  401: '登录已失效，请重新登录。',
  403: '当前账号没有执行此操作的权限。',
  404: '请求的内容不存在。',
  409: '内容已被更新，请刷新后重试。',
  429: '操作过于频繁，请稍后重试。',
  500: '服务暂时出现异常，请稍后重试。',
  502: '暂时无法连接服务，请稍后重试。',
  503: '服务暂时不可用，请稍后重试。',
  504: '服务响应超时，请稍后重试。',
}

function isEnvelope(data: unknown): data is ApiResponse<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof data.code === 'number' &&
    'msg' in data &&
    typeof data.msg === 'string' &&
    'data' in data
  )
}

function rejectApiError(error: ApiError, config?: AxiosRequestConfig): never {
  const isProtectedUnauthorized = error.status === 401 && config?.requiresAuth !== false
  if (isProtectedUnauthorized) invalidateSession(config?.sessionToken || '')
  if (!config?.silent && !isProtectedUnauthorized) notify.error(error.message)
  throw error
}

export const http = axios.create({ baseURL: '/api/v1', timeout: 30000 })

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.sessionToken = config.requiresAuth === false ? '' : getToken()
  if (config.sessionToken) config.headers.set('Authorization', `Bearer ${config.sessionToken}`)
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    config.headers.set('x-request-id', crypto.randomUUID())
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const body: unknown = response.data
    const requestId = String(response.headers['x-request-id'] || '')
    if (!isEnvelope(body)) {
      return rejectApiError(
        new ApiError('服务返回了无法识别的内容。', -1, response.status, requestId),
        response.config,
      )
    }
    if (body.code !== 0) {
      return rejectApiError(
        new ApiError(body.msg || '操作未完成，请重试。', body.code, response.status, requestId),
        response.config,
      )
    }
    response.data = body.data
    return response
  },
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (!axios.isAxiosError(error)) {
      return rejectApiError(new ApiError('请求未完成，请重试。', -1, 0))
    }
    const status = error.response?.status || 0
    const message =
      statusMessages[status] ||
      (error.code === 'ECONNABORTED' ? '请求超时，请重试。' : '网络连接失败，请检查网络后重试。')
    return rejectApiError(
      new ApiError(
        message,
        status || -1,
        status,
        String(error.response?.headers['x-request-id'] || ''),
      ),
      error.config,
    )
  },
)

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await http.get<T>(url, config)).data
}

export async function post<T>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<T> {
  return (await http.post<T>(url, data, config)).data
}

export const isRequestCanceled = axios.isCancel
