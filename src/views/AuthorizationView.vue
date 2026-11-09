<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw, ShieldCheck } from '@lucide/vue'
import { ElButton, ElOption, ElSelect, ElTabPane, ElTabs } from 'element-plus'
import { authorizationApi } from '../api/authorization'
import { managementApi } from '../api/management'
import { isRequestCanceled } from '../api/http'
import DirectoryPanel from '../components/authorization/DirectoryPanel.vue'
import OperationCard from '../components/authorization/OperationCard.vue'
import OperationsPanel from '../components/authorization/OperationsPanel.vue'
import PermissionTestPanel from '../components/authorization/PermissionTestPanel.vue'
import RelationsPanel from '../components/authorization/RelationsPanel.vue'
import EmptyState from '../components/common/EmptyState.vue'
import PageHeader from '../components/common/PageHeader.vue'
import { useAuthorizationCommand } from '../composables/use-authorization-command'
import { usePagedOptions } from '../composables/use-paged-options'
import { useAuthStore } from '../stores/auth'
import type {
  AuthorizationCommand,
  AuthorizationSystemState,
  OperationReceipt,
} from '../types/authorization'
import type { ManagedSystem, Tenant } from '../types/management'
import { commandLabels } from '../utils/authorization'
import '../assets/styles/authorization.scss'

const auth = useAuthStore()
const tenantId = ref('')
const systemId = ref('')
const selectedSystem = ref<ManagedSystem | null>(null)
const tenants = usePagedOptions<Tenant>((query, pageNum, signal) =>
  managementApi.listMyTenants({ name: query, pageNum, pageSize: 20 }, signal),
)
const systems = usePagedOptions<ManagedSystem>((query, pageNum, signal) =>
  managementApi.listSystems(
    { tenantId: tenantId.value, name: query, pageNum, pageSize: 20 },
    signal,
  ),
)
const state = ref<AuthorizationSystemState | null>(null)
const stateLoading = ref(false)
const stateError = ref(false)
const operationId = ref('')
const tab = ref('relation')
const revision = ref(0)
const commands = useAuthorizationCommand(() => auth.user?.userId || '', systemId)
const directoryTab = computed(() =>
  ['subject', 'resourceType', 'action', 'resource'].includes(tab.value)
    ? (tab.value as 'subject' | 'resourceType' | 'action' | 'resource')
    : null,
)
const gateLabels = {
  uninitialized: '尚未初始化',
  pending: '变更处理中',
  ready: '授权已就绪',
  blocked: '任务已阻塞',
}
const canWrite = computed(
  () =>
    !!state.value?.initialized &&
    state.value.gateState !== 'blocked' &&
    selectedSystem.value?.status === 'active',
)
const canCheck = computed(
  () => state.value?.gateState === 'ready' && selectedSystem.value?.status === 'active',
)
let generation = 0
let controller: AbortController | undefined
let alive = true
const observed = new Map<string, string>()

async function loadState(): Promise<void> {
  const system = systemId.value
  if (!system) return
  const current = ++generation
  controller?.abort()
  controller = new AbortController()
  stateLoading.value = true
  stateError.value = false
  try {
    const next = await authorizationApi.state(system, controller.signal)
    if (!alive || current !== generation) return
    state.value = next
    if (!operationId.value)
      operationId.value =
        next.blockedOperationId || (next.gateState === 'pending' ? next.lastOperationId || '' : '')
  } catch (error) {
    if (current === generation && !isRequestCanceled(error)) {
      state.value = null
      stateError.value = true
    }
  } finally {
    if (current === generation) stateLoading.value = false
  }
}
async function refresh(): Promise<void> {
  revision.value++
  await loadState()
}
async function submitCommand(
  command: AuthorizationCommand,
  expectedSystem: string,
): Promise<OperationReceipt | null> {
  if (!alive || systemId.value !== expectedSystem) return null
  const result = await commands.send(command)
  if (result && alive && result.systemId === systemId.value) {
    operationId.value = result.operationId
    revision.value++
    await loadState()
  }
  return result
}
async function recoverIntent(): Promise<void> {
  const result = await commands.send()
  if (result && alive && result.systemId === systemId.value) {
    operationId.value = result.operationId
    await refresh()
  }
}
function operationUpdated(receipt: OperationReceipt): void {
  if (!alive || receipt.systemId !== systemId.value) return
  const previous = observed.get(receipt.operationId)
  observed.set(receipt.operationId, receipt.state)
  if (
    previous !== receipt.state &&
    (receipt.state === 'applied' || receipt.state === 'blocked' || previous === 'blocked')
  )
    void refresh()
}
function chooseSystem(id: string): void {
  selectedSystem.value = systems.items.value.find((item) => item.id === id) || null
  systemId.value = selectedSystem.value?.id || ''
}
watch(tenantId, async () => {
  systemId.value = ''
  selectedSystem.value = null
  systems.clear()
  if (!tenantId.value) return
  const selectedTenant = tenantId.value
  await systems.load()
  if (alive && selectedTenant === tenantId.value && systems.total.value === 1)
    chooseSystem(systems.items.value[0]?.id || '')
})
watch(
  systemId,
  () => {
    generation++
    controller?.abort()
    state.value = null
    stateError.value = false
    stateLoading.value = false
    operationId.value = ''
    observed.clear()
    if (systemId.value) void loadState()
  },
  { flush: 'sync' },
)
onMounted(async () => {
  await tenants.load()
  if (alive && tenants.total.value === 1) tenantId.value = tenants.items.value[0]?.id || ''
})
onBeforeUnmount(() => {
  alive = false
  generation++
  controller?.abort()
})
</script>

<template>
  <div class="management-page authz-page">
    <PageHeader title="授权管理" description="为接入系统登记资源、分配权限，并追踪每一次变更。">
      <template #actions
        ><ElButton
          :disabled="!systemId || commands.busy.value"
          :loading="stateLoading"
          @click="refresh"
          ><RefreshCw aria-hidden="true" />刷新</ElButton
        ></template
      >
    </PageHeader>
    <section class="surface authz-scope" aria-label="当前授权范围">
      <label for="authorization-tenant"
        >管理租户
        <ElSelect
          id="authorization-tenant"
          v-model="tenantId"
          filterable
          remote
          clearable
          :remote-method="tenants.search"
          :loading="tenants.loading.value"
          :disabled="commands.busy.value"
          placeholder="选择你管理的租户"
          @visible-change="
            (visible: boolean) => {
              if (visible) void tenants.load()
            }
          "
        >
          <ElOption
            v-for="tenant in tenants.items.value"
            :key="tenant.id"
            :value="tenant.id"
            :label="tenant.name"
          />
          <template #footer
            ><ElButton
              v-if="tenants.items.value.length < tenants.total.value"
              text
              :loading="tenants.loading.value"
              @click="tenants.load(true)"
              >加载更多租户</ElButton
            ></template
          >
        </ElSelect>
      </label>
      <label for="authorization-system"
        >接入系统
        <ElSelect
          id="authorization-system"
          :model-value="systemId"
          filterable
          remote
          clearable
          :remote-method="systems.search"
          :loading="systems.loading.value"
          :disabled="!tenantId || commands.busy.value"
          placeholder="选择接入系统"
          @update:model-value="chooseSystem"
          @visible-change="
            (visible: boolean) => {
              if (visible) void systems.load()
            }
          "
        >
          <ElOption
            v-for="system in systems.items.value"
            :key="system.id"
            :value="system.id"
            :label="`${system.name}${system.status === 'disabled' ? '（已停用）' : ''}`"
          />
          <template #footer
            ><ElButton
              v-if="systems.items.value.length < systems.total.value"
              text
              :loading="systems.loading.value"
              @click="systems.load(true)"
              >加载更多系统</ElButton
            ></template
          >
        </ElSelect>
      </label>
      <p class="authz-help">
        每个系统独立授权。这里只显示当前账号实际管理的有效租户，平台超管也需要管理员关联。
      </p>
    </section>
    <p v-if="tenants.failed.value || systems.failed.value" class="inline-error" role="status">
      范围加载失败，请重新打开选择器查询。
    </p>
    <EmptyState
      v-if="!systemId"
      :title="
        !tenants.loading.value && !tenants.failed.value && tenants.total.value === 0
          ? '暂无可管理的租户'
          : '选择一个接入系统'
      "
      description="先选择租户和系统。没有管理员关联时，请联系平台管理员分配。"
    />
    <template v-else>
      <p v-if="stateError" class="inline-error" role="status">
        无法读取系统授权状态。请刷新后重试，当前不会开放写入。
      </p>
      <section v-if="state" class="surface authz-system-state" aria-label="系统授权状态">
        <div class="authz-state-icon"><ShieldCheck aria-hidden="true" /></div>
        <div class="authz-state-copy">
          <h2>{{ gateLabels[state.gateState] }}</h2>
          <p>已生效 {{ state.appliedSequence }} / 已受理 {{ state.acceptedSequence }}</p>
        </div>
        <ElButton
          v-if="state.gateState === 'uninitialized'"
          type="primary"
          :disabled="selectedSystem?.status !== 'active' || !!commands.intent.value"
          :loading="commands.busy.value"
          @click="submitCommand({ kind: 'initialize' }, systemId)"
          >初始化授权</ElButton
        >
        <ElButton
          v-if="state.blockedOperationId"
          type="primary"
          plain
          @click="operationId = state.blockedOperationId"
          >查看阻塞任务</ElButton
        >
      </section>
      <p v-if="selectedSystem?.status === 'disabled'" class="session-notice">
        此系统已停用，可查看目录和撤销已有授权，恢复后才能登记或授予新权限。
      </p>
      <section
        v-if="commands.intent.value && !commands.busy.value"
        class="authz-intent session-notice"
        role="status"
      >
        <div>
          <strong>{{ commandLabels[commands.intent.value.command.kind] }}的受理结果待确认</strong>
          <p>原请求已保留。继续确认会复用同一请求，不会新建第二个操作。</p>
        </div>
        <ElButton :loading="commands.busy.value" @click="recoverIntent">继续确认原请求</ElButton>
      </section>
      <OperationCard
        v-if="operationId"
        :key="`${systemId}:${operationId}`"
        :system-id="systemId"
        :operation-id="operationId"
        @updated="operationUpdated"
      />
      <ElTabs v-model="tab" class="authz-tabs" aria-label="授权管理内容">
        <ElTabPane label="直接授权" name="relation" /><ElTabPane label="业务主体" name="subject" />
        <ElTabPane label="资源类型" name="resourceType" /><ElTabPane label="动作" name="action" />
        <ElTabPane label="资源实例" name="resource" /><ElTabPane
          label="任务"
          name="operation"
        /><ElTabPane label="权限测试" name="test" />
      </ElTabs>
      <ElSelect v-model="tab" class="authz-mobile-tabs" aria-label="切换授权管理栏目">
        <ElOption label="直接授权" value="relation" /><ElOption label="业务主体" value="subject" />
        <ElOption label="资源类型" value="resourceType" /><ElOption label="动作" value="action" />
        <ElOption label="资源实例" value="resource" /><ElOption
          label="任务"
          value="operation"
        /><ElOption label="权限测试" value="test" />
      </ElSelect>
      <DirectoryPanel
        v-if="directoryTab"
        :key="`${systemId}:${directoryTab}`"
        :kind="directoryTab"
        :system-id="systemId"
        :enabled="canWrite"
        :busy="commands.busy.value"
        :write-locked="!!commands.intent.value"
        :revision="revision"
        :submit="submitCommand"
        @operation="operationId = $event"
      />
      <RelationsPanel
        v-else-if="tab === 'relation'"
        :key="systemId"
        :system-id="systemId"
        :enabled="canWrite"
        :busy="commands.busy.value"
        :write-locked="!!commands.intent.value"
        :revision="revision"
        :submit="submitCommand"
        @operation="operationId = $event"
      />
      <OperationsPanel
        v-else-if="tab === 'operation'"
        :key="systemId"
        :system-id="systemId"
        :revision="revision"
        @operation="operationId = $event"
      />
      <PermissionTestPanel
        v-else-if="tab === 'test'"
        :key="systemId"
        :system-id="systemId"
        :enabled="canCheck"
        :revision="revision"
      />
    </template>
  </div>
</template>
