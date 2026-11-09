import { post } from './http'
import type { PageResp } from '../types/api'
import type {
  AuthorizationCommand,
  AuthorizationListRequest,
  AuthorizationRelation,
  AuthorizationResource,
  AuthorizationSubject,
  AuthorizationSystemState,
  CommandKind,
  OperationReceipt,
  PermissionDecision,
  PermissionQuery,
  RelationDetail,
  ResourceAction,
  ResourceType,
} from '../types/authorization'

const paths: Record<CommandKind, string> = {
  initialize: 'system/initialize',
  register_subject: 'subject/register',
  register_type: 'resourceType/register',
  register_action: 'action/register',
  register_resource: 'resource/register',
  grant: 'grant',
  revoke: 'revoke',
}
const list = <T>(path: string, request: AuthorizationListRequest, signal?: AbortSignal) =>
  post<PageResp<T>>(`/authorization/${path}/list`, request, { signal })

export const authorizationApi = {
  subjects: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<AuthorizationSubject>('subject', request, signal),
  types: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<ResourceType>('resourceType', request, signal),
  actions: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<ResourceAction>('action', request, signal),
  resources: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<AuthorizationResource>('resource', request, signal),
  relations: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<AuthorizationRelation>('relation', request, signal),
  operations: (request: AuthorizationListRequest, signal?: AbortSignal) =>
    list<OperationReceipt>('operation', request, signal),
  state: (systemId: string, signal?: AbortSignal) =>
    post<AuthorizationSystemState>('/authorization/system/state', { systemId }, { signal }),
  operation: (systemId: string, operationId: string, signal?: AbortSignal) =>
    post<OperationReceipt>(
      '/authorization/operation/detail',
      { systemId, operationId },
      { signal, silent: true },
    ),
  retry: (systemId: string, operationId: string, version: number) =>
    post<OperationReceipt>('/authorization/operation/retry', { systemId, operationId, version }),
  relation: (systemId: string, query: PermissionQuery, signal?: AbortSignal) =>
    post<RelationDetail>(
      '/authorization/relation/detail',
      { systemId, ...query },
      { signal, silent: true },
    ),
  check: (systemId: string, query: PermissionQuery, signal?: AbortSignal) =>
    post<PermissionDecision>('/authorization/check', { systemId, ...query }, { signal }),
  submit: (systemId: string, idempotencyKey: string, command: AuthorizationCommand) => {
    const { kind, ...fields } = command
    return post<OperationReceipt>(`/authorization/${paths[kind]}`, {
      systemId,
      idempotencyKey,
      ...fields,
    })
  },
}
