import { ApiError, get, post } from './http'
import type { LoginRequest, LoginResponse, UserProfile } from '../types/auth'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUserProfile(value: unknown): value is UserProfile {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    value.userId.length > 0 &&
    typeof value.username === 'string' &&
    value.username.length > 0 &&
    typeof value.name === 'string' &&
    (value.platformRole === 'platform_admin' || value.platformRole === 'none')
  )
}

export async function login(
  credentials: LoginRequest,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const result = await post<unknown>('/pub/auth/login', credentials, {
    requiresAuth: false,
    silent: true,
    signal,
  })
  if (
    !isRecord(result) ||
    typeof result.accessToken !== 'string' ||
    !result.accessToken ||
    typeof result.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(result.expiresAt)) ||
    !isUserProfile(result.user)
  ) {
    throw new ApiError('服务返回的登录信息不完整，请联系管理员。', -1, 200)
  }
  return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user }
}

export async function getProfile(signal?: AbortSignal): Promise<UserProfile> {
  const profile = await get<unknown>('/auth/me', { silent: true, signal })
  if (!isUserProfile(profile)) {
    throw new ApiError('服务返回的账号信息不完整，请联系管理员。', -1, 200)
  }
  return profile
}
