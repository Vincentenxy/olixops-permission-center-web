<script setup lang="ts">
import { toRef, watch, ref, onBeforeUnmount } from 'vue'
import { ElButton } from 'element-plus'
import { authorizationApi } from '../../api/authorization'
import { useOperationMonitor } from '../../composables/use-operation-monitor'
import type { OperationReceipt } from '../../types/authorization'
import { commandLabels } from '../../utils/authorization'
import { formatDateTime } from '../../utils/format'
import OperationStatus from './OperationStatus.vue'

const props = defineProps<{ systemId: string; operationId: string }>()
const emit = defineEmits<{ updated: [receipt: OperationReceipt] }>()
const monitor = useOperationMonitor(toRef(props, 'systemId'), toRef(props, 'operationId'))
const retrying = ref(false)
let alive = true
onBeforeUnmount(() => {
  alive = false
})
watch(monitor.receipt, (value) => {
  if (value) emit('updated', value)
})
async function retry(): Promise<void> {
  const operation = monitor.receipt.value
  if (!operation || retrying.value) return
  retrying.value = true
  try {
    const next = await authorizationApi.retry(
      props.systemId,
      operation.operationId,
      operation.version,
    )
    if (!alive) return
    emit('updated', next)
    monitor.resume()
  } catch {
    /* Shared HTTP error notification. */
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <section class="surface authz-operation" aria-label="当前授权任务" aria-live="polite">
    <div class="authz-operation-heading">
      <div>
        <span class="authz-kicker">执行进度</span>
        <h2>
          {{ monitor.receipt.value ? commandLabels[monitor.receipt.value.kind] : '读取任务' }}
        </h2>
      </div>
      <OperationStatus v-if="monitor.receipt.value" :state="monitor.receipt.value.state" />
    </div>
    <p class="authz-monospace">{{ operationId }}</p>
    <p v-if="monitor.receipt.value?.state === 'applied'" class="authz-help">
      已确认生效 · {{ formatDateTime(monitor.receipt.value.appliedAt || '') }}
    </p>
    <p v-else class="authz-help">请求已受理。只有任务显示「已生效」才表示变更完成。</p>
    <p v-if="monitor.receipt.value?.errorReason" class="inline-error">
      原因：{{ monitor.receipt.value.errorReason }}
    </p>
    <p v-if="monitor.notice.value" class="session-notice" role="status">
      {{ monitor.notice.value }}
    </p>
    <div class="authz-inline-actions">
      <ElButton :loading="monitor.loading.value" :disabled="retrying" @click="monitor.resume"
        >刷新进度</ElButton
      >
      <ElButton
        v-if="monitor.receipt.value?.state === 'blocked'"
        type="primary"
        :loading="retrying"
        @click="retry"
        >恢复此任务</ElButton
      >
    </div>
  </section>
</template>
