const STORAGE_KEY = 'olixops.permission.session'

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

let token = readStoredToken()
let invalidationHandler: (() => void) | undefined

export function getToken(): string {
  return token
}

export function setToken(value: string): void {
  token = value
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Restricted browser storage still permits an in-memory session.
  }
}

export function onSessionInvalidated(handler: () => void): void {
  invalidationHandler = handler
}

export function invalidateSession(requestToken: string): void {
  // An old request must never log out a newer session.
  if (!requestToken || requestToken !== token) return
  setToken('')
  invalidationHandler?.()
}
