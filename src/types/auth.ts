export interface UserProfile {
  userId: string
  username: string
  name: string
  platformRole: 'platform_admin' | 'none'
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: UserProfile
}
