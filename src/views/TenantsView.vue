<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Ban, CircleCheck, Pencil, Plus, RotateCcw, Search, UserPlus, Users } from '@lucide/vue'
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
import PageHeader from '../components/common/PageHeader.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { usePagedList } from '../composables/use-paged-list'
import { useAuthStore } from '../stores/auth'
import type { AdminUser, EntityStatus, Tenant, TenantMember } from '../types/management'
import { formatDateTime } from '../utils/format'

const auth = useAuthStore()
const isPlatformAdmin = computed(() => auth.user?.platformRole === 'platform_admin')
const filters = reactive({ code: '', name: '', status: '' as EntityStatus | '' })
const tenants = usePagedList((pageNum, pageSize, signal) =>
  managementApi.listTenants({ ...filters, pageNum, pageSize }, signal),
)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const formError = ref('')
const tenantForm = reactive({ id: '', version: 0, code: '', name: '', remark: '' })

const memberDrawerVisible = ref(false)
const selectedTenant = ref<Tenant | null>(null)
const members = ref<TenantMember[]>([])
const membersLoading = ref(false)
const memberStatusLoading = ref('')
const memberSubmitting = ref(false)
const selectedUserId = ref('')
const users = ref<AdminUser[]>([])
const usersLoading = ref(false)
let userSearchController: AbortController | undefined
let userSearchGeneration = 0

function resetFilters(): void {
  filters.code = ''
  filters.name = ''
  filters.status = ''
  void tenants.load(true)
}

function openCreate(): void {
  dialogMode.value = 'create'
  Object.assign(tenantForm, { id: '', version: 0, code: '', name: '', remark: '' })
  formError.value = ''
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const tenant = row as Tenant
  dialogMode.value = 'edit'
  Object.assign(tenantForm, tenant)
  formError.value = ''
  dialogVisible.value = true
}

function validateTenant(): boolean {
  formError.value = ''
  if (dialogMode.value === 'create' && !/^[a-z][a-z0-9_-]{0,63}$/.test(tenantForm.code)) {
    formError.value = '编码需以小写字母开头，只能包含小写字母、数字、下划线或短横线。'
  } else if (!tenantForm.name.trim()) {
    formError.value = '请输入租户名称。'
  }
  return !formError.value
}

async function submitTenant(): Promise<void> {
  if (!validateTenant() || submitting.value) return
  submitting.value = true
  try {
    if (dialogMode.value === 'create') {
      await managementApi.createTenant({
        code: tenantForm.code,
        name: tenantForm.name.trim(),
        remark: tenantForm.remark.trim(),
      })
      ElMessage.success('租户已创建')
    } else {
      await managementApi.updateTenant({
        id: tenantForm.id,
        version: tenantForm.version,
        name: tenantForm.name.trim(),
        remark: tenantForm.remark.trim(),
      })
      ElMessage.success('租户资料已更新')
    }
    dialogVisible.value = false
    await tenants.load(dialogMode.value === 'create')
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    submitting.value = false
  }
}

async function changeTenantStatus(row: unknown): Promise<void> {
  const tenant = row as Tenant
  const next = oppositeStatus(tenant.status)
  const verb = next === 'active' ? '恢复' : '停用'
  try {
    await ElMessageBox.confirm(`确认${verb}租户“${tenant.name}”？`, `${verb}租户`, {
      customClass: 'vault-confirm-message-box',
      confirmButtonText: verb,
      cancelButtonText: '取消',
      confirmButtonClass: next === 'disabled' ? 'vault-delete-confirm-button' : '',
      type: next === 'disabled' ? 'warning' : 'info',
    })
  } catch {
    return
  }
  submitting.value = true
  try {
    await managementApi.setTenantStatus({ id: tenant.id, version: tenant.version, status: next })
    ElMessage.success(`租户已${verb}`)
    await tenants.load()
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    submitting.value = false
  }
}

async function loadMembers(): Promise<void> {
  if (!selectedTenant.value) return
  membersLoading.value = true
  try {
    const result = await managementApi.listMembers({
      tenantId: selectedTenant.value.id,
      pageNum: 1,
      pageSize: 200,
    })
    members.value = result.list
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

async function searchUsers(query: string): Promise<void> {
  const username = query.trim()
  const current = ++userSearchGeneration
  userSearchController?.abort()
  if (!isPlatformAdmin.value || username.length < 2) {
    users.value = []
    usersLoading.value = false
    return
  }
  userSearchController = new AbortController()
  usersLoading.value = true
  try {
    const result = await managementApi.listUsers(
      { username, status: 'active', pageNum: 1, pageSize: 50 },
      userSearchController.signal,
    )
    if (current === userSearchGeneration) users.value = result.list
  } catch {
    if (current === userSearchGeneration) users.value = []
  } finally {
    if (current === userSearchGeneration) usersLoading.value = false
  }
}

async function openMembers(row: unknown): Promise<void> {
  const tenant = row as Tenant
  selectedTenant.value = tenant
  selectedUserId.value = ''
  users.value = []
  memberDrawerVisible.value = true
  await loadMembers()
}

async function allocateMember(): Promise<void> {
  if (!selectedTenant.value || !selectedUserId.value || memberSubmitting.value) return
  memberSubmitting.value = true
  try {
    await managementApi.allocateMember(selectedTenant.value.id, selectedUserId.value)
    selectedUserId.value = ''
    users.value = []
    ElMessage.success('租户管理员已分配')
    await loadMembers()
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    memberSubmitting.value = false
  }
}

async function changeMemberStatus(member: TenantMember): Promise<void> {
  const next = oppositeStatus(member.status)
  memberStatusLoading.value = member.id
  try {
    await managementApi.setMemberStatus({ id: member.id, version: member.version, status: next })
    ElMessage.success(next === 'active' ? '管理员关联已恢复' : '管理员关联已停用')
    await loadMembers()
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    memberStatusLoading.value = ''
  }
}

onMounted(() => void tenants.load())
</script>

<template>
  <div class="management-page">
    <PageHeader title="租户" description="维护权限中心的隔离边界与租户管理员。">
      <template v-if="isPlatformAdmin" #actions>
        <ElButton type="primary" @click="openCreate"><Plus aria-hidden="true" />新建租户</ElButton>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="租户筛选">
      <ElInput
        v-model="filters.code"
        clearable
        placeholder="租户编码"
        @keyup.enter="tenants.load(true)"
      />
      <ElInput
        v-model="filters.name"
        clearable
        placeholder="租户名称"
        @keyup.enter="tenants.load(true)"
      />
      <ElSelect v-model="filters.status" clearable placeholder="全部状态">
        <ElOption label="正常" value="active" />
        <ElOption label="已停用" value="disabled" />
      </ElSelect>
      <div class="filter-actions">
        <ElButton type="primary" :loading="tenants.loading.value" @click="tenants.load(true)">
          <Search aria-hidden="true" />查询
        </ElButton>
        <ElButton aria-label="重置筛选" @click="resetFilters"
          ><RotateCcw aria-hidden="true" />重置</ElButton
        >
      </div>
    </section>

    <section v-loading="tenants.loading.value" class="data-surface" aria-live="polite">
      <ElTable v-if="tenants.list.value.length" :data="tenants.list.value" row-key="id">
        <ElTableColumn label="租户" min-width="220">
          <template #default="{ row }">
            <div class="primary-cell">
              <strong>{{ row.name }}</strong
              ><code>{{ row.code }}</code>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }"><StatusBadge :status="row.status" /></template>
        </ElTableColumn>
        <ElTableColumn prop="remark" label="备注" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updateAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="170" fixed="right" align="right">
          <template #default="{ row }">
            <ElButton
              text
              class="icon-button"
              aria-label="查看租户管理员"
              @click="openMembers(row)"
            >
              <Users aria-hidden="true" />
            </ElButton>
            <template v-if="isPlatformAdmin">
              <ElButton text class="icon-button" aria-label="编辑租户" @click="openEdit(row)">
                <Pencil aria-hidden="true" />
              </ElButton>
              <ElButton
                text
                class="icon-button"
                :aria-label="row.status === 'active' ? '停用租户' : '恢复租户'"
                :disabled="submitting"
                @click="changeTenantStatus(row)"
              >
                <Ban v-if="row.status === 'active'" aria-hidden="true" />
                <CircleCheck v-else aria-hidden="true" />
              </ElButton>
            </template>
          </template>
        </ElTableColumn>
      </ElTable>
      <EmptyState
        v-else-if="!tenants.loading.value"
        title="暂无租户"
        description="没有符合当前筛选条件的租户。"
      />
      <ElPagination
        v-if="tenants.total.value > 0"
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
        :total="tenants.total.value"
        :current-page="tenants.pageNum.value"
        :page-size="tenants.pageSize.value"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="tenants.changePage"
        @size-change="tenants.changePageSize"
      />
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建租户' : '编辑租户'"
      width="min(92vw, 520px)"
      destroy-on-close
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <form class="dialog-form" @submit.prevent="submitTenant">
        <label v-if="dialogMode === 'create'"
          >租户编码<ElInput v-model="tenantForm.code" maxlength="64"
        /></label>
        <label>租户名称<ElInput v-model="tenantForm.name" maxlength="128" /></label>
        <label
          >备注<ElInput
            v-model="tenantForm.remark"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
        /></label>
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      </form>
      <template #footer>
        <ElButton :disabled="submitting" @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitTenant">确认</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="memberDrawerVisible" size="min(92vw, 620px)" destroy-on-close>
      <template #header
        ><div class="drawer-title">
          <span>租户管理员</span><small>{{ selectedTenant?.name }}</small>
        </div></template
      >
      <div v-if="isPlatformAdmin" class="inline-create-form">
        <ElSelect
          v-model="selectedUserId"
          filterable
          remote
          clearable
          :remote-method="searchUsers"
          :loading="usersLoading"
          placeholder="输入至少 2 位登录账号搜索"
        >
          <ElOption
            v-for="user in users"
            :key="user.id"
            :label="`${user.name} (${user.username})`"
            :value="user.id"
            :disabled="
              members.some((member) => member.userId === user.id && member.status === 'active')
            "
          />
        </ElSelect>
        <ElButton
          type="primary"
          :loading="memberSubmitting"
          :disabled="!selectedUserId"
          @click="allocateMember"
        >
          <UserPlus aria-hidden="true" />分配
        </ElButton>
      </div>
      <div v-loading="membersLoading" class="drawer-list">
        <div v-for="member in members" :key="member.id" class="drawer-list-item">
          <div>
            <strong>{{ member.name }}</strong
            ><span>{{ member.username }}</span>
          </div>
          <StatusBadge :status="member.status" />
          <ElButton
            v-if="isPlatformAdmin"
            text
            class="icon-button"
            :loading="memberStatusLoading === member.id"
            :aria-label="member.status === 'active' ? '停用管理员关联' : '恢复管理员关联'"
            @click="changeMemberStatus(member)"
          >
            <Ban v-if="member.status === 'active'" aria-hidden="true" />
            <CircleCheck v-else aria-hidden="true" />
          </ElButton>
        </div>
        <EmptyState
          v-if="!membersLoading && !members.length"
          title="暂无管理员"
          description="该租户还没有管理员关联。"
        />
      </div>
    </ElDrawer>
  </div>
</template>
