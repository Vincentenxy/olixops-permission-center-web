<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Ban,
  CircleCheck,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldOff,
} from '@lucide/vue'
import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus'
import { managementApi, oppositeStatus } from '../api/management'
import EmptyState from '../components/common/EmptyState.vue'
import IssuedTokenDialog from '../components/common/IssuedTokenDialog.vue'
import PageHeader from '../components/common/PageHeader.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { usePagedList } from '../composables/use-paged-list'
import { useAuthStore } from '../stores/auth'
import type {
  CredentialCreationCheck,
  CredentialCreationReason,
  EntityStatus,
  ManagedSystem,
  SystemCredential,
  SystemDetail,
  Tenant,
} from '../types/management'
import { formatDateTime } from '../utils/format'

const auth = useAuthStore()
const isPlatformAdmin = computed(() => auth.user?.platformRole === 'platform_admin')
const filters = reactive({
  tenantId: '',
  code: '',
  name: '',
  status: '' as EntityStatus | '',
})
const systems = usePagedList((pageNum, pageSize, signal) =>
  managementApi.listSystems({ ...filters, pageNum, pageSize }, signal),
)
const tenants = ref<Tenant[]>([])
const tenantLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const rowLoading = ref('')
const formError = ref('')
const systemForm = reactive({ id: '', version: 0, tenantId: '', code: '', name: '', remark: '' })

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<SystemDetail | null>(null)
const credentials = ref<SystemCredential[]>([])
const credentialCheck = ref<CredentialCreationCheck | null>(null)
const credentialName = ref('')
const credentialSubmitting = ref(false)
const credentialLoading = ref('')
const issuedToken = ref('')
const issuedVisible = ref(false)
const activeCredential = computed(() => credentials.value.find((item) => item.status === 'active'))
const credentialReason = computed(() => {
  const labels: Record<CredentialCreationReason, string> = {
    '': '',
    tenantDisabled: '所属租户已停用，恢复租户后才能创建 Token。',
    tenantAdminRequired: '当前账号不是该租户的有效管理员，不能创建 Token。',
    systemDisabled: '当前系统已停用，恢复系统后才能创建 Token。',
    accountDisabled: '调用账号已停用，恢复账号后才能创建 Token。',
    activeCredentialExists: '当前已有有效 Token，如需重发请先显式吊销。',
  }
  return labels[credentialCheck.value?.reason || '']
})

function tenantName(id: string): string {
  return tenants.value.find((tenant) => tenant.id === id)?.name || id
}

async function loadTenants(): Promise<void> {
  tenantLoading.value = true
  try {
    const result = isPlatformAdmin.value
      ? await managementApi.listTenants({ pageNum: 1, pageSize: 200 })
      : await managementApi.listMyTenants({ pageNum: 1, pageSize: 200 })
    tenants.value = result.list
  } catch {
    tenants.value = []
  } finally {
    tenantLoading.value = false
  }
}

function resetFilters(): void {
  filters.tenantId = ''
  filters.code = ''
  filters.name = ''
  filters.status = ''
  void systems.load(true)
}

function openCreate(): void {
  dialogMode.value = 'create'
  Object.assign(systemForm, {
    id: '',
    version: 0,
    tenantId: filters.tenantId || (tenants.value.length === 1 ? tenants.value[0]?.id || '' : ''),
    code: '',
    name: '',
    remark: '',
  })
  formError.value = ''
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const system = row as ManagedSystem
  dialogMode.value = 'edit'
  Object.assign(systemForm, system)
  formError.value = ''
  dialogVisible.value = true
}

function validateSystem(): boolean {
  formError.value = ''
  if (dialogMode.value === 'create' && !systemForm.tenantId) {
    formError.value = '请选择所属租户。'
  } else if (dialogMode.value === 'create' && !/^[a-z][a-z0-9_-]{0,63}$/.test(systemForm.code)) {
    formError.value = '编码需以小写字母开头，只能包含小写字母、数字、下划线或短横线。'
  } else if (!systemForm.name.trim()) {
    formError.value = '请输入系统名称。'
  }
  return !formError.value
}

async function submitSystem(): Promise<void> {
  if (!validateSystem() || submitting.value) return
  submitting.value = true
  try {
    if (dialogMode.value === 'create') {
      await managementApi.createSystem({
        tenantId: systemForm.tenantId,
        code: systemForm.code,
        name: systemForm.name.trim(),
        remark: systemForm.remark.trim(),
      })
      ElMessage.success('接入系统已创建')
    } else {
      await managementApi.updateSystem({
        id: systemForm.id,
        version: systemForm.version,
        name: systemForm.name.trim(),
        remark: systemForm.remark.trim(),
      })
      ElMessage.success('系统资料已更新')
    }
    dialogVisible.value = false
    await systems.load(dialogMode.value === 'create')
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    submitting.value = false
  }
}

async function changeSystemStatus(row: unknown): Promise<void> {
  const system = row as ManagedSystem
  const next = oppositeStatus(system.status)
  const verb = next === 'active' ? '恢复' : '停用'
  try {
    await ElMessageBox.confirm(`确认${verb}系统“${system.name}”？`, `${verb}系统`, {
      customClass: 'vault-confirm-message-box',
      confirmButtonText: verb,
      cancelButtonText: '取消',
      confirmButtonClass: next === 'disabled' ? 'vault-delete-confirm-button' : '',
      type: next === 'disabled' ? 'warning' : 'info',
    })
  } catch {
    return
  }
  rowLoading.value = system.id
  try {
    await managementApi.setSystemStatus({ id: system.id, version: system.version, status: next })
    ElMessage.success(`系统已${verb}`)
    await systems.load()
    if (detail.value?.system.id === system.id) await loadDetail(system.id)
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    rowLoading.value = ''
  }
}

async function loadDetail(id: string): Promise<void> {
  detailLoading.value = true
  const controller = new AbortController()
  try {
    const [systemDetail, credentialPage, creationCheck] = await Promise.all([
      managementApi.getSystem(id, controller.signal),
      managementApi.listCredentials(id, controller.signal),
      managementApi.checkCredentialCreation(id, controller.signal),
    ])
    detail.value = systemDetail
    credentials.value = credentialPage.list
    credentialCheck.value = creationCheck
  } catch {
    detail.value = null
    credentials.value = []
    credentialCheck.value = null
  } finally {
    detailLoading.value = false
  }
}

async function openDetail(row: unknown): Promise<void> {
  const system = row as ManagedSystem
  detailVisible.value = true
  credentialName.value = ''
  await loadDetail(system.id)
}

async function changeAccountStatus(): Promise<void> {
  if (!detail.value || rowLoading.value) return
  const account = detail.value.account
  const next = oppositeStatus(account.status)
  rowLoading.value = account.id
  try {
    await managementApi.setAccountStatus({ id: account.id, version: account.version, status: next })
    ElMessage.success(next === 'active' ? '调用账号已恢复' : '调用账号已停用')
    await loadDetail(detail.value.system.id)
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    rowLoading.value = ''
  }
}

async function createCredential(): Promise<void> {
  if (
    !detail.value ||
    !credentialCheck.value?.allowed ||
    !credentialName.value.trim() ||
    credentialSubmitting.value
  )
    return
  credentialSubmitting.value = true
  try {
    const result = await managementApi.createCredential(
      detail.value.account.id,
      credentialName.value.trim(),
    )
    credentialName.value = ''
    credentials.value = [result.credential, ...credentials.value]
    credentialCheck.value = { allowed: false, reason: 'activeCredentialExists' }
    issuedToken.value = result.token
    issuedVisible.value = true
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    credentialSubmitting.value = false
  }
}

async function revokeCredential(credential: SystemCredential): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `吊销后该 Token 将立即失效，确认吊销“${credential.name}”？`,
      '吊销 Token',
      {
        customClass: 'vault-confirm-message-box',
        confirmButtonText: '吊销',
        cancelButtonText: '取消',
        confirmButtonClass: 'vault-delete-confirm-button',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  credentialLoading.value = credential.id
  try {
    await managementApi.revokeCredential(credential.id, credential.version)
    ElMessage.success('Token 已吊销')
    if (detail.value) await loadDetail(detail.value.system.id)
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    credentialLoading.value = ''
  }
}

function clearIssuedToken(): void {
  issuedToken.value = ''
}

onMounted(() => {
  void Promise.all([systems.load(), loadTenants()])
})
</script>

<template>
  <div class="management-page">
    <PageHeader title="系统接入" description="维护租户内的接入系统、调用账号和固定 Token。">
      <template #actions>
        <ElButton type="primary" @click="openCreate"><Plus aria-hidden="true" />新建系统</ElButton>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="系统筛选">
      <ElSelect
        v-model="filters.tenantId"
        clearable
        filterable
        :loading="tenantLoading"
        placeholder="全部租户"
      >
        <ElOption
          v-for="tenant in tenants"
          :key="tenant.id"
          :label="tenant.name"
          :value="tenant.id"
        />
      </ElSelect>
      <ElInput
        v-model="filters.code"
        clearable
        placeholder="系统编码"
        @keyup.enter="systems.load(true)"
      />
      <ElInput
        v-model="filters.name"
        clearable
        placeholder="系统名称"
        @keyup.enter="systems.load(true)"
      />
      <ElSelect v-model="filters.status" clearable placeholder="全部状态">
        <ElOption label="正常" value="active" />
        <ElOption label="已停用" value="disabled" />
      </ElSelect>
      <div class="filter-actions">
        <ElButton type="primary" :loading="systems.loading.value" @click="systems.load(true)">
          <Search aria-hidden="true" />查询
        </ElButton>
        <ElButton @click="resetFilters"><RotateCcw aria-hidden="true" />重置</ElButton>
      </div>
    </section>

    <section v-loading="systems.loading.value" class="data-surface" aria-live="polite">
      <ElTable v-if="systems.list.value.length" :data="systems.list.value" row-key="id">
        <ElTableColumn label="系统" min-width="220">
          <template #default="{ row }">
            <div class="primary-cell">
              <strong>{{ row.name }}</strong
              ><code>{{ row.code }}</code>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="所属租户" min-width="180">
          <template #default="{ row }">{{ tenantName(row.tenantId) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }"><StatusBadge :status="row.status" /></template>
        </ElTableColumn>
        <ElTableColumn prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updateAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="150" fixed="right" align="right">
          <template #default="{ row }">
            <ElButton
              text
              class="icon-button"
              aria-label="查看系统接入详情"
              @click="openDetail(row)"
            >
              <Eye aria-hidden="true" />
            </ElButton>
            <ElButton text class="icon-button" aria-label="编辑系统" @click="openEdit(row)">
              <Pencil aria-hidden="true" />
            </ElButton>
            <ElButton
              text
              class="icon-button"
              :loading="rowLoading === row.id"
              :aria-label="row.status === 'active' ? '停用系统' : '恢复系统'"
              @click="changeSystemStatus(row)"
            >
              <Ban v-if="row.status === 'active'" aria-hidden="true" />
              <CircleCheck v-else aria-hidden="true" />
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <EmptyState
        v-else-if="!systems.loading.value"
        title="暂无接入系统"
        description="没有符合当前筛选条件的系统。"
      />
      <ElPagination
        v-if="systems.total.value > 0"
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
        :total="systems.total.value"
        :current-page="systems.pageNum.value"
        :page-size="systems.pageSize.value"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="systems.changePage"
        @size-change="systems.changePageSize"
      />
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建接入系统' : '编辑系统'"
      width="min(92vw, 520px)"
      destroy-on-close
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <form class="dialog-form" @submit.prevent="submitSystem">
        <label v-if="dialogMode === 'create'"
          >所属租户
          <ElSelect
            v-model="systemForm.tenantId"
            filterable
            :loading="tenantLoading"
            placeholder="请选择租户"
          >
            <ElOption
              v-for="tenant in tenants"
              :key="tenant.id"
              :label="tenant.name"
              :value="tenant.id"
              :disabled="tenant.status !== 'active'"
            />
          </ElSelect>
        </label>
        <label v-if="dialogMode === 'create'"
          >系统编码<ElInput v-model="systemForm.code" maxlength="64"
        /></label>
        <label>系统名称<ElInput v-model="systemForm.name" maxlength="128" /></label>
        <label
          >备注<ElInput
            v-model="systemForm.remark"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
        /></label>
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      </form>
      <template #footer>
        <ElButton :disabled="submitting" @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitSystem">确认</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailVisible" size="min(94vw, 680px)" destroy-on-close>
      <template #header>
        <div class="drawer-title">
          <span>系统接入详情</span><small>{{ detail?.system.name || '正在加载' }}</small>
        </div>
      </template>
      <div v-loading="detailLoading" class="system-detail">
        <template v-if="detail">
          <section class="detail-section">
            <div class="section-heading">
              <div>
                <h2>调用账号</h2>
                <p>{{ detail.account.name }}</p>
              </div>
              <StatusBadge :status="detail.account.status" />
            </div>
            <dl class="detail-grid">
              <div>
                <dt>账号 ID</dt>
                <dd class="monospace">{{ detail.account.id }}</dd>
              </div>
              <div>
                <dt>系统编码</dt>
                <dd>{{ detail.system.code }}</dd>
              </div>
              <div>
                <dt>所属租户</dt>
                <dd>{{ tenantName(detail.system.tenantId) }}</dd>
              </div>
            </dl>
            <ElButton :loading="rowLoading === detail.account.id" @click="changeAccountStatus">
              <ShieldOff aria-hidden="true" />{{
                detail.account.status === 'active' ? '停用调用账号' : '恢复调用账号'
              }}
            </ElButton>
          </section>

          <section class="detail-section">
            <div class="section-heading">
              <div>
                <h2>固定 Token</h2>
                <p>每个调用账号同时最多一把有效 Token。</p>
              </div>
            </div>
            <div v-if="credentialCheck?.allowed" class="inline-create-form">
              <ElInput
                v-model="credentialName"
                maxlength="128"
                placeholder="Token 名称"
                @keyup.enter="createCredential"
              />
              <ElButton
                type="primary"
                :loading="credentialSubmitting"
                :disabled="!credentialName.trim() || !credentialCheck.allowed"
                @click="createCredential"
              >
                <KeyRound aria-hidden="true" />创建 Token
              </ElButton>
            </div>
            <p
              v-else-if="!activeCredential && credentialCheck && credentialReason"
              class="credential-eligibility"
            >
              {{ credentialReason }}
            </p>
            <div class="credential-list">
              <div v-for="credential in credentials" :key="credential.id" class="credential-item">
                <div>
                  <strong>{{ credential.name }}</strong
                  ><code>{{ credential.keyId }}</code
                  ><span>{{ formatDateTime(credential.createAt) }}</span>
                </div>
                <StatusBadge :status="credential.status" />
                <ElButton
                  v-if="credential.status === 'active'"
                  text
                  class="icon-button danger-icon"
                  :loading="credentialLoading === credential.id"
                  aria-label="吊销 Token"
                  @click="revokeCredential(credential)"
                  ><Ban aria-hidden="true"
                /></ElButton>
              </div>
              <EmptyState
                v-if="!credentials.length"
                title="暂无 Token"
                description="创建后完整 Token 只显示一次。"
              />
            </div>
          </section>
        </template>
      </div>
    </ElDrawer>

    <IssuedTokenDialog v-model="issuedVisible" :token="issuedToken" @cleared="clearIssuedToken" />
  </div>
</template>
