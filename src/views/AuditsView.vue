<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Eye, RotateCcw, Search } from '@lucide/vue'
import {
  ElButton,
  ElDrawer,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus'
import { managementApi } from '../api/management'
import EmptyState from '../components/common/EmptyState.vue'
import PageHeader from '../components/common/PageHeader.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { usePagedList } from '../composables/use-paged-list'
import type { AuditEvent, ManagedSystem, Tenant } from '../types/management'
import { formatDateTime } from '../utils/format'

const filters = reactive({
  tenantId: '',
  systemId: '',
  action: '',
  requestId: '',
  result: '' as AuditEvent['result'] | '',
})
const audits = usePagedList((pageNum, pageSize, signal) =>
  managementApi.listAudits({ ...filters, pageNum, pageSize }, signal),
)
const tenants = ref<Tenant[]>([])
const systems = ref<ManagedSystem[]>([])
const optionsLoading = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AuditEvent | null>(null)
const formattedChanges = computed(() => {
  if (!detail.value?.changes) return '{}'
  try {
    return JSON.stringify(detail.value.changes, null, 2)
  } catch {
    return '{}'
  }
})

async function loadOptions(): Promise<void> {
  optionsLoading.value = true
  try {
    const [tenantPage, systemPage] = await Promise.all([
      managementApi.listTenants({ pageNum: 1, pageSize: 200 }),
      managementApi.listSystems({ pageNum: 1, pageSize: 200 }),
    ])
    tenants.value = tenantPage.list
    systems.value = systemPage.list
  } catch {
    tenants.value = []
    systems.value = []
  } finally {
    optionsLoading.value = false
  }
}

function resetFilters(): void {
  filters.tenantId = ''
  filters.systemId = ''
  filters.action = ''
  filters.requestId = ''
  filters.result = ''
  void audits.load(true)
}

async function openDetail(row: unknown): Promise<void> {
  const event = row as AuditEvent
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await managementApi.getAudit(event.id)
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

watch(
  () => filters.tenantId,
  (tenantId) => {
    if (
      filters.systemId &&
      systems.value.find((system) => system.id === filters.systemId)?.tenantId !== tenantId
    ) {
      filters.systemId = ''
    }
  },
)

onMounted(() => {
  void Promise.all([audits.load(), loadOptions()])
})
</script>

<template>
  <div class="management-page">
    <PageHeader title="审计" description="查询权限中心管理操作及其可信请求标识。" />

    <section class="filter-bar filter-bar-wide" aria-label="审计筛选">
      <ElSelect
        v-model="filters.tenantId"
        clearable
        filterable
        :loading="optionsLoading"
        placeholder="全部租户"
      >
        <ElOption
          v-for="tenant in tenants"
          :key="tenant.id"
          :label="tenant.name"
          :value="tenant.id"
        />
      </ElSelect>
      <ElSelect
        v-model="filters.systemId"
        clearable
        filterable
        :loading="optionsLoading"
        placeholder="全部系统"
      >
        <ElOption
          v-for="system in systems.filter(
            (item) => !filters.tenantId || item.tenantId === filters.tenantId,
          )"
          :key="system.id"
          :label="system.name"
          :value="system.id"
        />
      </ElSelect>
      <ElInput
        v-model="filters.action"
        clearable
        placeholder="操作类型"
        @keyup.enter="audits.load(true)"
      />
      <ElInput
        v-model="filters.requestId"
        clearable
        placeholder="Request ID"
        @keyup.enter="audits.load(true)"
      />
      <ElSelect v-model="filters.result" clearable placeholder="全部结果">
        <ElOption label="成功" value="success" />
        <ElOption label="已拒绝" value="denied" />
        <ElOption label="失败" value="failed" />
      </ElSelect>
      <div class="filter-actions">
        <ElButton type="primary" :loading="audits.loading.value" @click="audits.load(true)">
          <Search aria-hidden="true" />查询
        </ElButton>
        <ElButton @click="resetFilters"><RotateCcw aria-hidden="true" />重置</ElButton>
      </div>
    </section>

    <section v-loading="audits.loading.value" class="data-surface" aria-live="polite">
      <ElTable v-if="audits.list.value.length" :data="audits.list.value" row-key="id">
        <ElTableColumn label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作者" min-width="160">
          <template #default="{ row }">
            <div class="primary-cell">
              <strong>{{ row.actorName || row.actorType }}</strong
              ><span>{{ row.actorType }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="action" label="操作" min-width="190" />
        <ElTableColumn label="目标" min-width="190">
          <template #default="{ row }">
            <div class="primary-cell">
              <strong>{{ row.targetName || '—' }}</strong
              ><span>{{ row.targetType }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="租户 / 系统" min-width="200">
          <template #default="{ row }"
            >{{ row.tenantName || '—'
            }}<span v-if="row.systemName"> / {{ row.systemName }}</span></template
          >
        </ElTableColumn>
        <ElTableColumn label="结果" width="100">
          <template #default="{ row }"><StatusBadge :status="row.result" /></template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="74" fixed="right" align="right">
          <template #default="{ row }">
            <ElButton text class="icon-button" aria-label="查看审计详情" @click="openDetail(row)">
              <Eye aria-hidden="true" />
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <EmptyState
        v-else-if="!audits.loading.value"
        title="暂无审计记录"
        description="没有符合当前筛选条件的事件。"
      />
      <ElPagination
        v-if="audits.total.value > 0"
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
        :total="audits.total.value"
        :current-page="audits.pageNum.value"
        :page-size="audits.pageSize.value"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="audits.changePage"
        @size-change="audits.changePageSize"
      />
    </section>

    <ElDrawer v-model="detailVisible" size="min(94vw, 680px)" destroy-on-close>
      <template #header
        ><div class="drawer-title">
          <span>审计详情</span><small>{{ detail?.action || '正在加载' }}</small>
        </div></template
      >
      <div v-loading="detailLoading" class="audit-detail">
        <template v-if="detail">
          <div class="audit-result-row">
            <StatusBadge :status="detail.result" /><time>{{
              formatDateTime(detail.createAt)
            }}</time>
          </div>
          <dl class="detail-grid audit-grid">
            <div>
              <dt>操作者</dt>
              <dd>{{ detail.actorName || detail.actorType }}</dd>
            </div>
            <div>
              <dt>操作</dt>
              <dd>{{ detail.action }}</dd>
            </div>
            <div>
              <dt>目标</dt>
              <dd>{{ detail.targetName || detail.targetId || '—' }}</dd>
            </div>
            <div>
              <dt>租户</dt>
              <dd>{{ detail.tenantName || '—' }}</dd>
            </div>
            <div>
              <dt>系统</dt>
              <dd>{{ detail.systemName || '—' }}</dd>
            </div>
            <div>
              <dt>原因码</dt>
              <dd>{{ detail.reasonCode || '—' }}</dd>
            </div>
            <div class="detail-wide">
              <dt>Request ID</dt>
              <dd class="monospace">{{ detail.requestId }}</dd>
            </div>
          </dl>
          <section class="audit-changes">
            <h2>变更内容</h2>
            <pre><code>{{ formattedChanges }}</code></pre>
          </section>
        </template>
      </div>
    </ElDrawer>
  </div>
</template>
