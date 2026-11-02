import type { PageRequest } from './api'

export type EntityStatus = 'active' | 'disabled'
export type CredentialStatus = 'active' | 'revoked'
export type PlatformRole = 'platform_admin' | 'none'
export type CredentialCreationReason =
  | ''
  | 'tenantDisabled'
  | 'tenantAdminRequired'
  | 'systemDisabled'
  | 'accountDisabled'
  | 'activeCredentialExists'

export interface BaseEntity {
  id: string
  version: number
  createAt: string
  updateAt: string
}

export interface Tenant extends BaseEntity {
  code: string
  name: string
  status: EntityStatus
  remark: string
}

export interface AdminUser extends BaseEntity {
  username: string
  name: string
  platformRole: PlatformRole
  status: EntityStatus
  remark: string
}

export interface TenantMember extends BaseEntity {
  tenantId: string
  userId: string
  username: string
  name: string
  memberRole: 'tenant_admin'
  status: EntityStatus
}

export interface ManagedSystem extends BaseEntity {
  tenantId: string
  code: string
  name: string
  status: EntityStatus
  remark: string
}

export interface SystemAccount extends BaseEntity {
  systemId: string
  name: string
  status: EntityStatus
}

export interface SystemDetail {
  system: ManagedSystem
  account: SystemAccount
}

export interface SystemCredential extends BaseEntity {
  accountId: string
  keyId: string
  name: string
  status: CredentialStatus
  revokedAt: string | null
}

export interface IssuedCredential {
  credential: SystemCredential
  token: string
}

export interface CredentialCreationCheck {
  allowed: boolean
  reason: CredentialCreationReason
}

export interface AuditEvent {
  id: string
  actorType: 'user' | 'system_account' | 'bootstrap' | 'anonymous'
  actorId: string | null
  actorName: string
  tenantId: string | null
  tenantName: string
  systemId: string | null
  systemName: string
  accountId: string | null
  keyId: string
  targetType: string
  targetId: string | null
  targetName: string
  action: string
  result: 'success' | 'denied' | 'failed'
  reasonCode: string
  requestId: string
  changes: unknown
  createAt: string
}

export interface ResourceListRequest extends PageRequest {
  code?: string
  name?: string
  username?: string
  status?: EntityStatus | CredentialStatus | ''
  tenantId?: string
  systemId?: string
  platformRole?: PlatformRole | ''
}

export interface AuditListRequest extends PageRequest {
  tenantId?: string
  systemId?: string
  actorId?: string
  action?: string
  result?: AuditEvent['result'] | ''
  requestId?: string
  from?: string
  to?: string
}

export interface CreateResourceRequest {
  tenantId?: string
  code: string
  name: string
  remark: string
}

export interface UpdateResourceRequest {
  id: string
  version: number
  name: string
  remark: string
}

export interface SetStatusRequest {
  id: string
  version: number
  status: EntityStatus
}

export interface CreateUserRequest {
  username: string
  password: string
  name: string
  remark: string
}
