<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Ban, CircleCheck, Pencil, Plus, RotateCcw, Search, Shield, ShieldOff } from '@lucide/vue'
import {
  ElButton,
  ElDialog,
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
import type { AdminUser, EntityStatus, PlatformRole } from '../types/management'
import { formatDateTime } from '../utils/format'

const filters = reactive({
  username: '',
  name: '',
  status: '' as EntityStatus | '',
  platformRole: '' as PlatformRole | '',
})
const users = usePagedList((pageNum, pageSize, signal) =>
  managementApi.listUsers({ ...filters, pageNum, pageSize }, signal),
)
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const rowLoading = ref('')
const formError = ref('')
const userForm = reactive({ id: '', version: 0, username: '', password: '', name: '', remark: '' })

function resetFilters(): void {
  filters.username = ''
  filters.name = ''
  filters.status = ''
  filters.platformRole = ''
  void users.load(true)
}

function openCreate(): void {
  dialogMode.value = 'create'
  Object.assign(userForm, { id: '', version: 0, username: '', password: '', name: '', remark: '' })
  formError.value = ''
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const user = row as AdminUser
  dialogMode.value = 'edit'
  Object.assign(userForm, { ...user, password: '' })
  formError.value = ''
  dialogVisible.value = true
}

function validateUser(): boolean {
  formError.value = ''
  if (
    dialogMode.value === 'create' &&
    !/^[a-zA-Z0-9][a-zA-Z0-9_.@-]{2,63}$/.test(userForm.username)
  ) {
    formError.value = '账号为 3–64 位，首位为字母或数字，可包含 . _ @ -。'
  } else if (
    dialogMode.value === 'create' &&
    (userForm.password.length < 12 || userForm.password.length > 72)
  ) {
    formError.value = '初始密码长度必须为 12–72 个字符。'
  } else if (!userForm.name.trim()) {
    formError.value = '请输入显示名称。'
  }
  return !formError.value
}

async function submitUser(): Promise<void> {
  if (!validateUser() || submitting.value) return
  submitting.value = true
  try {
    if (dialogMode.value === 'create') {
      await managementApi.createUser({
        username: userForm.username.trim(),
        password: userForm.password,
        name: userForm.name.trim(),
        remark: userForm.remark.trim(),
      })
      userForm.password = ''
      ElMessage.success('管理员账号已创建')
    } else {
      await managementApi.updateUser({
        id: userForm.id,
        version: userForm.version,
        name: userForm.name.trim(),
        remark: userForm.remark.trim(),
      })
      ElMessage.success('管理员资料已更新')
    }
    dialogVisible.value = false
    await users.load(dialogMode.value === 'create')
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    userForm.password = ''
    submitting.value = false
  }
}

async function setStatus(row: unknown): Promise<void> {
  const user = row as AdminUser
  const next = oppositeStatus(user.status)
  const verb = next === 'active' ? '恢复' : '停用'
  try {
    await ElMessageBox.confirm(`确认${verb}账号“${user.name}”？`, `${verb}管理员`, {
      customClass: 'vault-confirm-message-box',
      confirmButtonText: verb,
      cancelButtonText: '取消',
      confirmButtonClass: next === 'disabled' ? 'vault-delete-confirm-button' : '',
      type: next === 'disabled' ? 'warning' : 'info',
    })
  } catch {
    return
  }
  rowLoading.value = user.id
  try {
    await managementApi.setUserStatus({ id: user.id, version: user.version, status: next })
    ElMessage.success(`账号已${verb}`)
    await users.load()
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    rowLoading.value = ''
  }
}

async function toggleRole(row: unknown): Promise<void> {
  const user = row as AdminUser
  const next: PlatformRole = user.platformRole === 'platform_admin' ? 'none' : 'platform_admin'
  const verb = next === 'platform_admin' ? '设为平台超管' : '取消平台超管'
  try {
    await ElMessageBox.confirm(`确认将“${user.name}”${verb}？`, '调整平台角色', {
      customClass: 'vault-confirm-message-box',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  rowLoading.value = user.id
  try {
    await managementApi.setUserRole(user.id, user.version, next)
    ElMessage.success('平台角色已更新')
    await users.load()
  } catch {
    // The HTTP interceptor has already shown the request error.
  } finally {
    rowLoading.value = ''
  }
}

onMounted(() => void users.load())
</script>

<template>
  <div class="management-page">
    <PageHeader title="管理员" description="维护后台账号和平台级管理角色。">
      <template #actions>
        <ElButton type="primary" @click="openCreate"><Plus aria-hidden="true" />新建账号</ElButton>
      </template>
    </PageHeader>

    <section class="filter-bar filter-bar-users" aria-label="管理员筛选">
      <ElInput
        v-model="filters.username"
        clearable
        placeholder="登录账号"
        @keyup.enter="users.load(true)"
      />
      <ElInput
        v-model="filters.name"
        clearable
        placeholder="显示名称"
        @keyup.enter="users.load(true)"
      />
      <ElSelect v-model="filters.platformRole" clearable placeholder="全部角色">
        <ElOption label="平台超管" value="platform_admin" />
        <ElOption label="普通账号" value="none" />
      </ElSelect>
      <ElSelect v-model="filters.status" clearable placeholder="全部状态">
        <ElOption label="正常" value="active" />
        <ElOption label="已停用" value="disabled" />
      </ElSelect>
      <div class="filter-actions">
        <ElButton type="primary" :loading="users.loading.value" @click="users.load(true)">
          <Search aria-hidden="true" />查询
        </ElButton>
        <ElButton @click="resetFilters"><RotateCcw aria-hidden="true" />重置</ElButton>
      </div>
    </section>

    <section v-loading="users.loading.value" class="data-surface" aria-live="polite">
      <ElTable v-if="users.list.value.length" :data="users.list.value" row-key="id">
        <ElTableColumn label="管理员" min-width="220">
          <template #default="{ row }">
            <div class="primary-cell">
              <strong>{{ row.name }}</strong
              ><span>{{ row.username }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="平台角色" width="120">
          <template #default="{ row }"><StatusBadge :status="row.platformRole" /></template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }"><StatusBadge :status="row.status" /></template>
        </ElTableColumn>
        <ElTableColumn prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <ElTableColumn label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updateAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="170" fixed="right" align="right">
          <template #default="{ row }">
            <ElButton text class="icon-button" aria-label="编辑管理员" @click="openEdit(row)">
              <Pencil aria-hidden="true" />
            </ElButton>
            <ElButton
              text
              class="icon-button"
              :loading="rowLoading === row.id"
              :aria-label="row.platformRole === 'platform_admin' ? '取消平台超管' : '设为平台超管'"
              @click="toggleRole(row)"
            >
              <ShieldOff v-if="row.platformRole === 'platform_admin'" aria-hidden="true" />
              <Shield v-else aria-hidden="true" />
            </ElButton>
            <ElButton
              text
              class="icon-button"
              :loading="rowLoading === row.id"
              :aria-label="row.status === 'active' ? '停用管理员' : '恢复管理员'"
              @click="setStatus(row)"
            >
              <Ban v-if="row.status === 'active'" aria-hidden="true" />
              <CircleCheck v-else aria-hidden="true" />
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <EmptyState
        v-else-if="!users.loading.value"
        title="暂无管理员"
        description="没有符合当前筛选条件的后台账号。"
      />
      <ElPagination
        v-if="users.total.value > 0"
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
        :total="users.total.value"
        :current-page="users.pageNum.value"
        :page-size="users.pageSize.value"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="users.changePage"
        @size-change="users.changePageSize"
      />
    </section>

    <ElDialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建管理员' : '编辑管理员'"
      width="min(92vw, 520px)"
      destroy-on-close
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      @closed="userForm.password = ''"
    >
      <form class="dialog-form" @submit.prevent="submitUser">
        <label v-if="dialogMode === 'create'"
          >登录账号<ElInput v-model="userForm.username" maxlength="64" autocomplete="off"
        /></label>
        <label v-if="dialogMode === 'create'"
          >初始密码<ElInput
            v-model="userForm.password"
            type="password"
            maxlength="72"
            show-password
            autocomplete="new-password"
        /></label>
        <label>显示名称<ElInput v-model="userForm.name" maxlength="128" /></label>
        <label
          >备注<ElInput
            v-model="userForm.remark"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
        /></label>
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      </form>
      <template #footer>
        <ElButton :disabled="submitting" @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitUser">确认</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
