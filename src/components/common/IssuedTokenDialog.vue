<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Copy } from '@lucide/vue'
import { ElButton, ElDialog, ElMessage } from 'element-plus'

const props = defineProps<{ modelValue: boolean; token: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; cleared: [] }>()
const copied = ref(false)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) copied.value = false
  },
)

async function copyToken(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.token)
    copied.value = true
    ElMessage.success('Token 已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择并复制。')
  }
}

function close(): void {
  emit('update:modelValue', false)
}

function cleared(): void {
  copied.value = false
  emit('cleared')
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    title="保存系统 Token"
    width="min(92vw, 620px)"
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="cleared"
  >
    <div class="issued-token-content">
      <p>这是 Token 唯一一次完整显示。关闭后无法再次查询，请立即保存到受控的秘密管理系统。</p>
      <pre><code>{{ token }}</code></pre>
    </div>
    <template #footer>
      <ElButton @click="copyToken">
        <Check v-if="copied" aria-hidden="true" /><Copy v-else aria-hidden="true" />
        {{ copied ? '已复制' : '复制 Token' }}
      </ElButton>
      <ElButton type="primary" @click="close">我已安全保存</ElButton>
    </template>
  </ElDialog>
</template>
