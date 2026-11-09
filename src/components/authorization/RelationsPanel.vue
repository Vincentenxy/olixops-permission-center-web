<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Plus, Search } from '@lucide/vue'
import {
  ElButton,
  ElDialog,
  ElInput,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus'
import { authorizationApi } from '../../api/authorization'
import { ApiError } from '../../api/http'
import { usePagedList } from '../../composables/use-paged-list'
import { confirmAction } from '../../utils/confirm-action'
import type {
  AuthorizationCommand,
  AuthorizationRelation,
  OperationReceipt,
  PermissionQuery,
} from '../../types/authorization'
import EmptyState from '../common/EmptyState.vue'
import ListPagination from '../common/ListPagination.vue'
import OperationStatus from './OperationStatus.vue'
import PermissionFields from './PermissionFields.vue'

const props = defineProps<{
  systemId: string
  enabled: boolean
  busy: boolean
  writeLocked: boolean
  revision: number
  submit: (command: AuthorizationCommand, systemId: string) => Promise<OperationReceipt | null>
}>()
const emit = defineEmits<{ operation: [id: string] }>()
const filters = reactive({ query: '', desired: '' })
const rows = usePagedList((pageNum, pageSize, signal) =>
  authorizationApi.relations(
    {
      systemId: props.systemId,
      query: filters.query,
      desiredPresent: filters.desired === '' ? undefined : filters.desired === 'true',
      pageNum,
      pageSize,
    },
    signal,
  ),
)
const visible = ref(false)
const query = ref<PermissionQuery | null>(null)
const resolving = ref(false)
const formError = ref('')
const rowBusy = ref('')
function openGrant(): void {
  visible.value = true
  formError.value = ''
  query.value = null
}
let alive = true
let controller: AbortController | undefined
onBeforeUnmount(() => {
  alive = false
  controller?.abort()
})

async function grant(): Promise<void> {
  if (!query.value || props.busy || props.writeLocked || resolving.value) return
  resolving.value = true
  formError.value = ''
  const system = props.systemId
  const permission = query.value
  controller = new AbortController()
  try {
    let expectedVersion = 0
    try {
      const relation = await authorizationApi.relation(system, permission, controller.signal)
      if (!alive) return
      if (relation.syncStatus !== 'applied') {
        formError.value = '该授权有未完成任务，请先等待或恢复任务。'
        return
      }
      expectedVersion = relation.version
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error
    }
    if (!alive) return
    const receipt = await props.submit({ kind: 'grant', ...permission, expectedVersion }, system)
    if (receipt) {
      visible.value = false
      await rows.load()
    }
  } catch (error) {
    formError.value =
      error instanceof ApiError ? error.message : '暂时无法读取授权版本，请稍后重试。'
  } finally {
    resolving.value = false
  }
}

async function change(value: unknown): Promise<void> {
  const row = value as AuthorizationRelation
  if (rowBusy.value || props.busy || props.writeLocked) return
  rowBusy.value = row.relationId
  const revoking = row.desiredPresent
  const system = props.systemId
  try {
    await confirmAction(
      {
        message: `${revoking ? '撤销' : '授予'} ${row.subjectName} 对 ${row.resourceName} 的 ${row.action} 权限？受理后需等待任务生效。`,
        title: revoking ? '撤销直接授权' : '重新授予权限',
        confirmText: revoking ? '撤销授权' : '确认授权',
        danger: revoking,
      },
      async () => {
        if (!alive) return
        controller = new AbortController()
        const current = await authorizationApi.relation(
          system,
          { subject: row.subject, resource: row.resource, action: row.action },
          controller.signal,
        )
        if (!alive) return
        if (current.version !== row.version || current.syncStatus !== 'applied') {
          formError.value = '授权声明已变化或尚未生效，请刷新列表后再操作。'
          await rows.load()
          return
        }
        await props.submit(
          {
            kind: revoking ? 'revoke' : 'grant',
            subject: row.subject,
            resource: row.resource,
            action: row.action,
            expectedVersion: current.version,
          },
          system,
        )
        await rows.load()
      },
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    formError.value =
      error instanceof ApiError ? error.message : '暂时无法读取授权版本，请稍后重试。'
  } finally {
    rowBusy.value = ''
  }
}
watch(
  () => props.systemId,
  () => {
    rows.clear()
    void rows.load(true)
  },
  { immediate: true },
)
watch(
  () => props.revision,
  () => {
    formError.value = ''
    void rows.load()
  },
)
</script>

<template>
  <section aria-label="直接授权">
    <div class="authz-section-heading">
      <div>
        <h2>直接授权</h2>
        <p>将一个具体资源的动作授予业务主体。列表显示管理声明，实际结果请使用权限测试。</p>
      </div>
      <ElButton
        type="primary"
        :disabled="!enabled || busy || writeLocked || !!rowBusy"
        @click="openGrant"
        ><Plus aria-hidden="true" />授予权限</ElButton
      >
    </div>
    <form class="filter-bar" @submit.prevent="rows.load(true)">
      <ElInput
        v-model="filters.query"
        aria-label="搜索主体或资源"
        placeholder="搜索主体或资源"
        clearable
      />
      <ElSelect v-model="filters.desired" aria-label="授权声明" placeholder="全部声明" clearable
        ><ElOption label="期望授予" value="true" /><ElOption label="期望撤销" value="false"
      /></ElSelect>
      <ElButton native-type="submit" :loading="rows.loading.value"
        ><Search aria-hidden="true" />查询</ElButton
      >
    </form>
    <p v-if="formError && !visible" class="inline-error" role="status">{{ formError }}</p>
    <p v-if="rows.failed.value" class="inline-error" role="status">列表加载失败，请重新查询。</p>
    <div class="data-surface" :aria-busy="rows.loading.value">
      <ElTable v-loading="rows.loading.value" :data="rows.list.value" row-key="relationId">
        <ElTableColumn label="业务主体" min-width="180"
          ><template #default="{ row }"
            ><strong>{{ row.subjectName }}</strong
            ><small class="authz-cell-detail"
              >{{ row.subject.type }}:{{ row.subject.id }}</small
            ></template
          ></ElTableColumn
        >
        <ElTableColumn label="资源" min-width="180"
          ><template #default="{ row }"
            ><strong>{{ row.resourceName }}</strong
            ><small class="authz-cell-detail"
              >{{ row.resource.type }}:{{ row.resource.id }}</small
            ></template
          ></ElTableColumn
        >
        <ElTableColumn prop="action" label="动作" width="110" />
        <ElTableColumn label="期望状态" width="120"
          ><template #default="{ row }">{{
            row.desiredPresent ? '授予' : '撤销'
          }}</template></ElTableColumn
        >
        <ElTableColumn label="同步" min-width="130"
          ><template #default="{ row }"><OperationStatus :state="row.syncStatus" /></template
        ></ElTableColumn>
        <ElTableColumn label="操作" width="200" fixed="right"
          ><template #default="{ row }">
            <ElButton text @click="emit('operation', row.lastOperationId)">查看任务</ElButton>
            <ElButton
              text
              :type="row.desiredPresent ? 'danger' : 'primary'"
              :loading="rowBusy === row.relationId"
              :disabled="
                (!enabled && !row.desiredPresent) ||
                row.syncStatus !== 'applied' ||
                busy ||
                writeLocked ||
                (!!rowBusy && rowBusy !== row.relationId)
              "
              @click="change(row)"
              >{{ row.desiredPresent ? '撤销' : '重新授予' }}</ElButton
            >
          </template></ElTableColumn
        >
        <template #empty
          ><EmptyState
            :title="filters.query || filters.desired ? '没有匹配的声明' : '尚无直接授权'"
            description="先登记主体、资源类型和动作、资源，再授予权限。"
        /></template>
      </ElTable>
      <ListPagination :pager="rows" />
    </div>
    <ElDialog
      v-model="visible"
      title="授予权限"
      width="min(560px, 92vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy && !resolving"
      :show-close="!busy && !resolving"
      destroy-on-close
    >
      <form id="grant-form" class="dialog-form" @submit.prevent="grant">
        <PermissionFields
          :system-id="systemId"
          id-prefix="grant"
          :disabled="busy || resolving || writeLocked"
          @update:model-value="query = $event"
        />
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
        <p v-if="writeLocked && !busy" class="session-notice">
          结果待确认。关闭窗口后，在页首继续确认原请求。
        </p>
        <p class="authz-help">仅授予所选资源的所选动作，不包含目录继承或整类资源授权。</p>
      </form>
      <template #footer
        ><ElButton :disabled="busy || resolving" @click="visible = false">关闭</ElButton
        ><ElButton
          type="primary"
          form="grant-form"
          native-type="submit"
          :loading="busy || resolving"
          :disabled="!query || writeLocked"
          >提交授权</ElButton
        ></template
      >
    </ElDialog>
  </section>
</template>
