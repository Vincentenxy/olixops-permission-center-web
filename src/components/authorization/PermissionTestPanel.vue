<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus'
import { authorizationApi } from '../../api/authorization'
import type { PermissionDecision, PermissionQuery } from '../../types/authorization'
import PermissionFields from './PermissionFields.vue'

const props = defineProps<{ systemId: string; enabled: boolean; revision: number }>()
const query = ref<PermissionQuery | null>(null)
const result = ref<PermissionDecision | null>(null)
const loading = ref(false)
const failed = ref(false)
let generation = 0
let controller: AbortController | undefined
function reset(): void {
  generation++
  controller?.abort()
  result.value = null
  failed.value = false
  loading.value = false
}
watch(() => [query.value, props.revision, props.systemId, props.enabled], reset)
async function check(): Promise<void> {
  if (!query.value || loading.value || !props.enabled) return
  const current = ++generation
  controller?.abort()
  controller = new AbortController()
  result.value = null
  failed.value = false
  loading.value = true
  try {
    const next = await authorizationApi.check(props.systemId, query.value, controller.signal)
    if (current === generation) result.value = next
  } catch {
    if (current === generation) failed.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}
onBeforeUnmount(reset)
</script>

<template>
  <section class="surface authz-test" aria-label="权限测试">
    <div class="authz-section-heading">
      <div>
        <h2>权限测试</h2>
        <p>验证当前系统中，业务主体是否拥有某个资源的某个动作。</p>
      </div>
    </div>
    <form class="dialog-form" @submit.prevent="check">
      <PermissionFields
        :system-id="systemId"
        :disabled="loading || !enabled"
        id-prefix="test"
        @update:model-value="query = $event"
      />
      <p class="authz-help">
        使用当前管理员身份测试授权结果，无需系统 Token。此测试不验证系统调用账号或密钥是否可用。
      </p>
      <div>
        <ElButton
          type="primary"
          native-type="submit"
          :loading="loading"
          :disabled="!query || !enabled"
          >判断权限</ElButton
        >
      </div>
    </form>
    <div
      v-if="result"
      :class="['authz-decision', { 'authz-decision--allowed': result.allowed }]"
      role="status"
    >
      <strong>{{ result.allowed ? '允许访问' : '无访问权限' }}</strong>
      <p>已确认的授权序号：{{ result.checkedSequence }}</p>
    </div>
    <p v-else-if="failed" class="inline-error" role="status">
      本次未得到权限判断结果。请确认服务和任务状态后重试。
    </p>
    <p v-else-if="!enabled" class="session-notice">系统授权尚未就绪，等待所有任务生效后再测试。</p>
  </section>
</template>
