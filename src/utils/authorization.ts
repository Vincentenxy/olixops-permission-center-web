import type { CommandKind, OperationState } from '../types/authorization'

export const commandLabels: Record<CommandKind, string> = {
  initialize: '初始化授权',
  register_subject: '登记主体',
  register_type: '登记资源类型',
  register_action: '登记动作',
  register_resource: '登记资源',
  grant: '授予权限',
  revoke: '撤销权限',
}
export const operationLabels: Record<OperationState, string> = {
  queued: '等待执行',
  running: '执行中',
  retry_wait: '等待自动重试',
  blocked: '需要恢复',
  applied: '已生效',
}
export const codePattern = /^[a-z][a-z0-9_]{0,63}$/
export function ready(entry: { status: string; syncStatus: string }): boolean {
  return entry.status === 'active' && entry.syncStatus === 'applied'
}
export function validText(value: string, max: number): boolean {
  return (
    value.length > 0 &&
    value === value.trim() &&
    new TextEncoder().encode(value).length <= max &&
    !/\p{Cc}/u.test(value)
  )
}
