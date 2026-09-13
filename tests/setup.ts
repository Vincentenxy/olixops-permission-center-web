import { afterEach, vi } from 'vitest'
import { onSessionInvalidated, setToken } from '../src/utils/token'

afterEach(() => {
  setToken('')
  onSessionInvalidated(() => {})
  sessionStorage.clear()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})
