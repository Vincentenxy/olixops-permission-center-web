import { post } from './http'
import type { PageResp } from '../types/api'
import type {
  AdminUser,
  AuditEvent,
  AuditListRequest,
  CredentialCreationCheck,
  CreateResourceRequest,
  CreateUserRequest,
  EntityStatus,
  IssuedCredential,
  ManagedSystem,
  PlatformRole,
  ResourceListRequest,
  SetStatusRequest,
  SystemAccount,
  SystemCredential,
  SystemDetail,
  Tenant,
  TenantMember,
  UpdateResourceRequest,
} from '../types/management'

export const managementApi = {
  listMyTenants: (request: ResourceListRequest, signal?: AbortSignal) =>
    post<PageResp<Tenant>>('/auth/tenant/list', request, { signal }),
  listTenants: (request: ResourceListRequest, signal?: AbortSignal) =>
    post<PageResp<Tenant>>('/tenant/list', request, { signal }),
  getTenant: (id: string, signal?: AbortSignal) =>
    post<Tenant>('/tenant/detail', { id }, { signal }),
  createTenant: (request: CreateResourceRequest) => post<Tenant>('/tenant/create', request),
  updateTenant: (request: UpdateResourceRequest) => post<Tenant>('/tenant/update', request),
  setTenantStatus: (request: SetStatusRequest) => post<Tenant>('/tenant/setStatus', request),

  listUsers: (request: ResourceListRequest, signal?: AbortSignal) =>
    post<PageResp<AdminUser>>('/user/list', request, { signal }),
  createUser: (request: CreateUserRequest) => post<AdminUser>('/user/create', request),
  updateUser: (request: UpdateResourceRequest) => post<AdminUser>('/user/update', request),
  setUserStatus: (request: SetStatusRequest) => post<AdminUser>('/user/setStatus', request),
  setUserRole: (id: string, version: number, platformRole: PlatformRole) =>
    post<AdminUser>('/user/setPlatformRole', { id, version, platformRole }),

  listMembers: (request: ResourceListRequest, signal?: AbortSignal) =>
    post<PageResp<TenantMember>>('/tenant/member/list', request, { signal }),
  allocateMember: (tenantId: string, userId: string) =>
    post<TenantMember>('/tenant/member/allocate', { tenantId, userId }),
  setMemberStatus: (request: SetStatusRequest) =>
    post<TenantMember>('/tenant/member/setStatus', request),

  listSystems: (request: ResourceListRequest, signal?: AbortSignal) =>
    post<PageResp<ManagedSystem>>('/system/list', request, { signal }),
  getSystem: (id: string, signal?: AbortSignal) =>
    post<SystemDetail>('/system/detail', { id }, { signal }),
  createSystem: (request: CreateResourceRequest) => post<SystemDetail>('/system/create', request),
  updateSystem: (request: UpdateResourceRequest) => post<ManagedSystem>('/system/update', request),
  setSystemStatus: (request: SetStatusRequest) => post<ManagedSystem>('/system/setStatus', request),
  setAccountStatus: (request: SetStatusRequest) =>
    post<SystemAccount>('/system/account/setStatus', request),

  listCredentials: (systemId: string, signal?: AbortSignal) =>
    post<PageResp<SystemCredential>>(
      '/system/credential/list',
      { systemId, pageNum: 1, pageSize: 200 },
      { signal },
    ),
  checkCredentialCreation: (systemId: string, signal?: AbortSignal) =>
    post<CredentialCreationCheck>('/system/credential/checkCreate', { systemId }, { signal }),
  createCredential: (accountId: string, name: string) =>
    post<IssuedCredential>('/system/credential/create', { accountId, name }),
  revokeCredential: (id: string, version: number) =>
    post<SystemCredential>('/system/credential/revoke', { id, version }),

  listAudits: (request: AuditListRequest, signal?: AbortSignal) =>
    post<PageResp<AuditEvent>>('/audit/list', request, { signal }),
  getAudit: (id: string, signal?: AbortSignal) =>
    post<AuditEvent>('/audit/detail', { id }, { signal }),
}

export function oppositeStatus(status: EntityStatus): EntityStatus {
  return status === 'active' ? 'disabled' : 'active'
}
