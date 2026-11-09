import type { PageRequest } from './api'
import type { EntityStatus } from './management'

export type SubjectType = 'user' | 'service'
export type OperationState = 'queued' | 'running' | 'retry_wait' | 'blocked' | 'applied'
export type CommandKind =
  | 'initialize'
  | 'register_subject'
  | 'register_type'
  | 'register_action'
  | 'register_resource'
  | 'grant'
  | 'revoke'
export interface SubjectRef {
  type: SubjectType
  id: string
}
export interface ResourceRef {
  type: string
  id: string
}
export interface PermissionQuery {
  subject: SubjectRef
  resource: ResourceRef
  action: string
}
export interface DirectoryEntry {
  id: string
  systemId: string
  version: number
  name: string
  status: EntityStatus
  syncStatus: 'pending' | 'applied'
  lastOperationId: string
  createAt: string
}
export interface AuthorizationSubject extends DirectoryEntry {
  subjectType: SubjectType
  externalId: string
}
export interface ResourceType extends DirectoryEntry {
  code: string
  resourceCount: number
}
export interface ResourceAction extends DirectoryEntry {
  code: string
  resourceType: string
}
export interface AuthorizationResource extends DirectoryEntry {
  externalId: string
  resourceType: string
}
export interface AuthorizationRelation extends PermissionQuery {
  relationId: string
  version: number
  desiredPresent: boolean
  syncStatus: 'pending' | 'applied'
  lastOperationId: string
  subjectName: string
  resourceName: string
}
export type RelationDetail = Pick<
  AuthorizationRelation,
  'relationId' | 'version' | 'desiredPresent' | 'syncStatus' | 'lastOperationId'
>
export interface OperationReceipt {
  operationId: string
  kind: CommandKind
  systemId: string
  sequence: string
  state: OperationState
  version: number
  targetType: string
  targetId: string
  targetVersion: number
  errorReason: string
  createAt: string
  appliedAt: string | null
}
export interface AuthorizationSystemState {
  systemId: string
  initialized: boolean
  gateState: 'uninitialized' | 'ready' | 'pending' | 'blocked'
  acceptedSequence: string
  appliedSequence: string
  blockedOperationId: string | null
  lastOperationId: string | null
  errorReason: string
}
export interface AuthorizationListRequest extends PageRequest {
  systemId: string
  query?: string
  subjectType?: SubjectType | ''
  resourceType?: string
  desiredPresent?: boolean
  state?: OperationState | ''
  kind?: CommandKind | ''
}
export interface PermissionDecision {
  allowed: boolean
  checkedSequence: string
}
export type AuthorizationCommand =
  | { kind: 'initialize' }
  | { kind: 'register_subject'; subject: SubjectRef; name: string }
  | { kind: 'register_type'; code: string; name: string }
  | { kind: 'register_action'; resourceType: string; code: string; name: string }
  | { kind: 'register_resource'; resource: ResourceRef; name: string }
  | ({ kind: 'grant' | 'revoke'; expectedVersion: number } & PermissionQuery)
