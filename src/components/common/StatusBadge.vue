<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()

const label = computed(() => {
  const labels: Record<string, string> = {
    active: '正常',
    disabled: '已停用',
    revoked: '已吊销',
    success: '成功',
    denied: '已拒绝',
    failed: '失败',
    platform_admin: '平台超管',
    tenant_admin: '租户管理员',
    none: '普通账号',
  }
  return labels[props.status] || props.status
})
</script>

<template>
  <span class="status-badge" :class="`status-${status}`">{{ label }}</span>
</template>
