import { onBeforeUnmount, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { authorizationApi } from '../api/authorization'
import { ApiError } from '../api/http'
import type { AuthorizationCommand, OperationReceipt } from '../types/authorization'
import { commandLabels } from '../utils/authorization'

interface Intent {
  idempotencyKey: string
  command: AuthorizationCommand
}

// Store only an unfinished management intent in this tab, never credentials.
// An uncertain response must not turn into a second command after navigation.
export function useAuthorizationCommand(
  user: MaybeRefOrGetter<string>,
  system: MaybeRefOrGetter<string>,
) {
  const intent = shallowRef<Intent | null>(null)
  const busy = ref(false)
  let generation = 0
  let alive = true
  const storageKey = () => `opc.authorization.intent.${toValue(user)}.${toValue(system)}`

  watch(
    () => [toValue(user), toValue(system)],
    () => {
      generation++
      busy.value = false
      intent.value = null
      if (!toValue(user) || !toValue(system)) return
      try {
        const value: unknown = JSON.parse(sessionStorage.getItem(storageKey()) || 'null')
        if (
          value &&
          typeof value === 'object' &&
          'idempotencyKey' in value &&
          typeof value.idempotencyKey === 'string' &&
          /^[0-9a-f-]{36}$/.test(value.idempotencyKey) &&
          'command' in value &&
          value.command &&
          typeof value.command === 'object' &&
          'kind' in value.command &&
          typeof value.command.kind === 'string' &&
          Object.hasOwn(commandLabels, value.command.kind)
        ) {
          intent.value = value as Intent
        }
      } catch {
        /* Storage can be unavailable; the in-memory intent still protects retries. */
      }
    },
    { immediate: true, flush: 'sync' },
  )

  async function send(command?: AuthorizationCommand): Promise<OperationReceipt | null> {
    if (!alive || busy.value || !toValue(user) || !toValue(system)) return null
    if (!intent.value) {
      if (!command) return null
      intent.value = {
        idempotencyKey: crypto.randomUUID(),
        command: JSON.parse(JSON.stringify(command)) as AuthorizationCommand,
      }
    }
    const pending = intent.value
    const key = storageKey()
    try {
      sessionStorage.setItem(key, JSON.stringify(pending))
    } catch {
      /* In-memory fallback. */
    }
    const current = generation
    busy.value = true
    try {
      const receipt = await authorizationApi.submit(
        toValue(system),
        pending.idempotencyKey,
        pending.command,
      )
      if (current !== generation) return null
      intent.value = null
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* No persisted intent. */
      }
      return receipt
    } catch (error) {
      if (current !== generation) return null
      // These statuses confirm rejection. Timeouts, transport and server errors
      // remain uncertain: preserve the original key and immutable payload.
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status)) {
        intent.value = null
        try {
          sessionStorage.removeItem(key)
        } catch {
          /* In-memory fallback. */
        }
      }
      return null
    } finally {
      if (current === generation) busy.value = false
    }
  }
  onBeforeUnmount(() => {
    alive = false
    generation++
  })
  return { intent, busy, send }
}
