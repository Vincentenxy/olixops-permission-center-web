import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { CanceledError } from 'axios'
import { getProfile, login as requestLogin } from '../api/auth'
import { ApiError, isRequestCanceled } from '../api/http'
import type { LoginRequest, UserProfile } from '../types/auth'
import { getToken, setToken } from '../utils/token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const sessionError = ref('')
  const token = ref(getToken())
  const authenticated = computed(() => Boolean(token.value && user.value))
  let generation = 0
  let controller: AbortController | undefined
  let restorePromise: Promise<void> | undefined

  function logout(): void {
    generation++
    controller?.abort()
    controller = undefined
    restorePromise = undefined
    setToken('')
    token.value = ''
    user.value = null
    sessionError.value = ''
    loading.value = false
  }

  async function login(credentials: LoginRequest): Promise<void> {
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    sessionError.value = ''
    try {
      const result = await requestLogin(credentials, controller.signal)
      if (current !== generation) throw new CanceledError()
      setToken(result.accessToken)
      token.value = result.accessToken
      user.value = result.user
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function restore(): Promise<void> {
    if (!token.value || user.value) return
    if (restorePromise) return restorePromise
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    sessionError.value = ''
    restorePromise = (async () => {
      try {
        const profile = await getProfile(controller?.signal)
        if (current === generation) user.value = profile
      } catch (error) {
        if (current !== generation || isRequestCanceled(error)) return
        if (error instanceof ApiError && error.status === 401) logout()
        else
          sessionError.value = error instanceof ApiError ? error.message : '暂时无法读取账号信息。'
      } finally {
        if (current === generation) {
          loading.value = false
          restorePromise = undefined
        }
      }
    })()
    return restorePromise
  }

  async function refresh(): Promise<void> {
    user.value = null
    await restore()
  }

  return { user, token, authenticated, loading, sessionError, login, logout, restore, refresh }
})
