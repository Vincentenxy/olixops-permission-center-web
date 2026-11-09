<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElButton, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus'
import { authorizationApi } from '../../api/authorization'
import { usePagedList } from '../../composables/use-paged-list'
import type { CommandKind, OperationState } from '../../types/authorization'
import { commandLabels, operationLabels } from '../../utils/authorization'
import { formatDateTime } from '../../utils/format'
import EmptyState from '../common/EmptyState.vue'
import ListPagination from '../common/ListPagination.vue'
import OperationStatus from './OperationStatus.vue'

const props = defineProps<{ systemId: string; revision: number }>()
const emit = defineEmits<{ operation: [id: string] }>()
const filters = reactive({ state: '' as OperationState | '', kind: '' as CommandKind | '' })
const rows = usePagedList((pageNum, pageSize, signal) =>
  authorizationApi.operations({ systemId: props.systemId, ...filters, pageNum, pageSize }, signal),
)
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
    void rows.load()
  },
)
</script>

<template>
  <section aria-label="授权任务">
    <div class="authz-section-heading">
      <div>
        <h2>授权任务</h2>
        <p>按接收顺序执行。阻塞任务需当前有效管理员显式恢复，后续任务会继续等待。</p>
      </div>
    </div>
    <form class="filter-bar" @submit.prevent="rows.load(true)">
      <ElSelect v-model="filters.state" clearable aria-label="任务状态" placeholder="全部状态"
        ><ElOption
          v-for="(label, state) in operationLabels"
          :key="state"
          :label="label"
          :value="state"
      /></ElSelect>
      <ElSelect v-model="filters.kind" clearable aria-label="操作类型" placeholder="全部操作"
        ><ElOption v-for="(label, kind) in commandLabels" :key="kind" :label="label" :value="kind"
      /></ElSelect>
      <ElButton native-type="submit" :loading="rows.loading.value">查询</ElButton>
    </form>
    <p v-if="rows.failed.value" class="inline-error" role="status">
      任务列表加载失败，请重新查询。
    </p>
    <div class="data-surface" :aria-busy="rows.loading.value">
      <ElTable v-loading="rows.loading.value" :data="rows.list.value" row-key="operationId">
        <ElTableColumn prop="sequence" label="序号" width="90" />
        <ElTableColumn label="操作" min-width="140"
          ><template #default="{ row }">{{
            commandLabels[row.kind as CommandKind]
          }}</template></ElTableColumn
        >
        <ElTableColumn prop="operationId" label="任务编号" min-width="290" />
        <ElTableColumn label="状态" min-width="160"
          ><template #default="{ row }"><OperationStatus :state="row.state" /></template
        ></ElTableColumn>
        <ElTableColumn label="接受时间" min-width="180"
          ><template #default="{ row }">{{ formatDateTime(row.createAt) }}</template></ElTableColumn
        >
        <ElTableColumn label="进度" width="120" fixed="right"
          ><template #default="{ row }"
            ><ElButton text @click="emit('operation', row.operationId)"
              >查看任务</ElButton
            ></template
          ></ElTableColumn
        >
        <template #empty
          ><EmptyState
            title="没有符合条件的任务"
            description="提交登记或授权后，可在这里追踪执行结果。"
        /></template>
      </ElTable>
      <ListPagination :pager="rows" />
    </div>
  </section>
</template>
