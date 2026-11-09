<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
import { usePagedList } from '../../composables/use-paged-list'
import type {
  AuthorizationCommand,
  AuthorizationResource,
  AuthorizationSubject,
  OperationReceipt,
  ResourceAction,
  ResourceType,
  SubjectType,
} from '../../types/authorization'
import { codePattern, validText } from '../../utils/authorization'
import EmptyState from '../common/EmptyState.vue'
import ListPagination from '../common/ListPagination.vue'
import DirectorySelect from './DirectorySelect.vue'
import OperationStatus from './OperationStatus.vue'

type DirectoryKind = 'subject' | 'resourceType' | 'action' | 'resource'
type Row = AuthorizationSubject | ResourceType | ResourceAction | AuthorizationResource
const props = defineProps<{
  systemId: string
  kind: DirectoryKind
  enabled: boolean
  busy: boolean
  writeLocked: boolean
  revision: number
  submit: (command: AuthorizationCommand, systemId: string) => Promise<OperationReceipt | null>
}>()
const emit = defineEmits<{ operation: [id: string] }>()
const labels: Record<DirectoryKind, { title: string; description: string }> = {
  subject: {
    title: '业务主体',
    description: '登记接入系统中的用户或服务身份，与后台管理员账号相互独立。',
  },
  resourceType: { title: '资源类型', description: '用稳定编码定义资源类别，例如 folder、secret。' },
  action: {
    title: '资源动作',
    description: '先配置 read、update 等动作，再登记该类型的资源实例。',
  },
  resource: {
    title: '资源实例',
    description: '登记需要保护的具体资源。相同业务标识在不同系统中独立。',
  },
}
const meta = computed(() => labels[props.kind])
const filters = reactive({ query: '', resourceType: '', subjectType: '' as SubjectType | '' })
const loaders = {
  subject: authorizationApi.subjects,
  resourceType: authorizationApi.types,
  action: authorizationApi.actions,
  resource: authorizationApi.resources,
}
const rows = usePagedList<Row>((pageNum, pageSize, signal) =>
  loaders[props.kind]({ ...filters, systemId: props.systemId, pageNum, pageSize }, signal),
)
const visible = ref(false)
const formError = ref('')
const form = reactive({
  name: '',
  code: '',
  externalId: '',
  subjectType: 'user' as SubjectType,
  typeId: '',
  resourceType: '',
})
const selectedType = ref<ResourceType | null>(null)

function open(): void {
  Object.assign(form, {
    name: '',
    code: '',
    externalId: '',
    subjectType: 'user',
    typeId: '',
    resourceType: '',
  })
  selectedType.value = null
  formError.value = ''
  visible.value = true
}
function chooseType(value: Row | null): void {
  selectedType.value = value && 'resourceCount' in value ? value : null
  form.resourceType = selectedType.value?.code || ''
}
async function save(): Promise<void> {
  if (props.busy || props.writeLocked) return
  formError.value = ''
  const name = form.name.trim()
  if (!validText(name, 128)) {
    formError.value = '名称不能为空，最多 128 个 UTF-8 字节，不能包含控制字符。'
    return
  }
  if ((props.kind === 'subject' || props.kind === 'resource') && !validText(form.externalId, 255)) {
    formError.value = '业务标识不能为空，最多 255 个 UTF-8 字节，不能包含首尾空白或控制字符。'
    return
  }
  if ((props.kind === 'resourceType' || props.kind === 'action') && !codePattern.test(form.code)) {
    formError.value = '编码以小写字母开头，可含小写字母、数字、下划线，最多 64 位。'
    return
  }
  if ((props.kind === 'resource' || props.kind === 'action') && !form.resourceType) {
    formError.value = '请选择已生效的资源类型。'
    return
  }
  if (props.kind === 'action' && selectedType.value && selectedType.value.resourceCount > 0) {
    formError.value = '该类型已有资源实例，首版不能继续新增动作。'
    return
  }
  let command: AuthorizationCommand
  switch (props.kind) {
    case 'subject':
      command = {
        kind: 'register_subject',
        subject: { type: form.subjectType, id: form.externalId },
        name,
      }
      break
    case 'resourceType':
      command = { kind: 'register_type', code: form.code, name }
      break
    case 'action':
      command = { kind: 'register_action', resourceType: form.resourceType, code: form.code, name }
      break
    case 'resource':
      command = {
        kind: 'register_resource',
        resource: { type: form.resourceType, id: form.externalId },
        name,
      }
      break
  }
  const result = await props.submit(command, props.systemId)
  if (result) {
    visible.value = false
    await rows.load()
  }
}
watch(
  () => [props.systemId, props.kind],
  () => {
    rows.clear()
    void rows.load(true)
  },
  { immediate: true },
)
watch(
  () => props.revision,
  () => {
    void rows.load()
  },
)
</script>

<template>
  <section aria-label="授权目录">
    <div class="authz-section-heading">
      <div>
        <h2>{{ meta.title }}</h2>
        <p>{{ meta.description }}</p>
      </div>
      <ElButton type="primary" :disabled="!enabled || busy || writeLocked" @click="open"
        ><Plus aria-hidden="true" />登记{{ meta.title }}</ElButton
      >
    </div>
    <form class="filter-bar" @submit.prevent="rows.load(true)">
      <ElInput
        id="directory-query"
        v-model="filters.query"
        clearable
        aria-label="名称或标识"
        placeholder="搜索名称或业务标识"
      />
      <ElSelect
        v-if="kind === 'subject'"
        v-model="filters.subjectType"
        clearable
        aria-label="主体类型"
        placeholder="全部主体类型"
      >
        <ElOption label="用户" value="user" /><ElOption label="服务" value="service" />
      </ElSelect>
      <ElInput
        v-if="kind === 'action' || kind === 'resource'"
        v-model="filters.resourceType"
        clearable
        aria-label="资源类型编码"
        placeholder="资源类型编码"
      />
      <ElButton native-type="submit" :loading="rows.loading.value"
        ><Search aria-hidden="true" />查询</ElButton
      >
    </form>
    <p v-if="rows.failed.value" class="inline-error" role="status">
      列表加载失败，当前内容可能不是最新，请重新查询。
    </p>
    <div class="data-surface" :aria-busy="rows.loading.value">
      <ElTable v-loading="rows.loading.value" :data="rows.list.value" row-key="id">
        <ElTableColumn prop="name" label="名称" min-width="160" />
        <ElTableColumn
          v-if="kind === 'subject' || kind === 'resource'"
          prop="externalId"
          label="业务标识"
          min-width="180"
        />
        <ElTableColumn v-else prop="code" label="编码" min-width="160" />
        <ElTableColumn v-if="kind === 'subject'" prop="subjectType" label="主体类型" width="110" />
        <ElTableColumn
          v-if="kind === 'action' || kind === 'resource'"
          prop="resourceType"
          label="资源类型"
          min-width="130"
        />
        <ElTableColumn
          v-if="kind === 'resourceType'"
          prop="resourceCount"
          label="资源数"
          width="100"
        />
        <ElTableColumn label="同步状态" min-width="140"
          ><template #default="{ row }"><OperationStatus :state="row.syncStatus" /></template
        ></ElTableColumn>
        <ElTableColumn label="任务" width="110" fixed="right"
          ><template #default="{ row }"
            ><ElButton text @click="emit('operation', row.lastOperationId)"
              >查看进度</ElButton
            ></template
          ></ElTableColumn
        >
        <template #empty
          ><EmptyState
            :title="
              filters.query || filters.resourceType || filters.subjectType
                ? '没有匹配的结果'
                : `尚未登记${meta.title}`
            "
            description="调整筛选条件，或先完成授权初始化并登记对象。"
        /></template>
      </ElTable>
      <ListPagination :pager="rows" />
    </div>
    <ElDialog
      v-model="visible"
      :title="`登记${meta.title}`"
      width="min(520px, 92vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
    >
      <form id="directory-form" class="dialog-form" @submit.prevent="save">
        <label v-if="kind === 'subject'" for="subject-type"
          >主体类型<ElSelect
            id="subject-type"
            v-model="form.subjectType"
            :disabled="busy || writeLocked"
            ><ElOption label="用户 user" value="user" /><ElOption
              label="服务 service"
              value="service" /></ElSelect
        ></label>
        <label v-if="kind === 'resource' || kind === 'action'" for="registration-type"
          >资源类型<DirectorySelect
            id="registration-type"
            v-model="form.typeId"
            kind="types"
            :system-id="systemId"
            :disabled="busy || writeLocked"
            @selected="chooseType"
        /></label>
        <p
          v-if="kind === 'action' && selectedType && selectedType.resourceCount > 0"
          class="inline-error"
        >
          此类型已有资源实例，不能新增动作。
        </p>
        <label v-if="kind === 'subject' || kind === 'resource'" for="external-id"
          >业务标识<ElInput
            id="external-id"
            v-model="form.externalId"
            :disabled="busy || writeLocked"
            placeholder="接入系统中的稳定 ID，区分大小写"
        /></label>
        <label v-else for="directory-code"
          >编码<ElInput
            id="directory-code"
            v-model="form.code"
            :disabled="busy || writeLocked"
            :placeholder="kind === 'action' ? '例如 read' : '例如 folder'"
        /></label>
        <label for="directory-name"
          >名称<ElInput
            id="directory-name"
            v-model="form.name"
            :disabled="busy || writeLocked"
            placeholder="用于管理页面展示"
        /></label>
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
        <p v-if="writeLocked && !busy" class="session-notice">
          结果待确认。关闭窗口后，在页首继续确认原请求。
        </p>
        <p class="authz-help">登记是创建操作，不会覆盖已存在的对象。受理后可查看执行进度。</p>
      </form>
      <template #footer
        ><ElButton :disabled="busy" @click="visible = false">关闭</ElButton
        ><ElButton
          type="primary"
          native-type="submit"
          form="directory-form"
          :loading="busy"
          :disabled="writeLocked"
          >提交登记</ElButton
        ></template
      >
    </ElDialog>
  </section>
</template>
