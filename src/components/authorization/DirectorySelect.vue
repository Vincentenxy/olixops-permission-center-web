<script setup lang="ts">
import { watch } from 'vue'
import { ElButton, ElOption, ElSelect } from 'element-plus'
import { authorizationApi } from '../../api/authorization'
import { usePagedOptions } from '../../composables/use-paged-options'
import type { PageResp } from '../../types/api'
import type {
  AuthorizationSubject,
  AuthorizationResource,
  ResourceAction,
  ResourceType,
} from '../../types/authorization'
import { ready } from '../../utils/authorization'

type Option = AuthorizationSubject | AuthorizationResource | ResourceAction | ResourceType
const props = defineProps<{
  kind: 'subjects' | 'types' | 'actions' | 'resources'
  systemId: string
  resourceType?: string
  modelValue: string
  disabled?: boolean
  id: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  selected: [value: Option | null]
}>()
const options = usePagedOptions<Option>(
  (query, pageNum, signal): Promise<PageResp<Option>> =>
    authorizationApi[props.kind](
      { systemId: props.systemId, resourceType: props.resourceType, query, pageNum, pageSize: 20 },
      signal,
    ),
)

function label(item: Option): string {
  if ('subjectType' in item) return `${item.name} · ${item.subjectType}:${item.externalId}`
  if ('externalId' in item) return `${item.name} · ${item.externalId}`
  return `${item.name} · ${item.code}`
}
function select(value: string): void {
  emit('update:modelValue', value)
  emit('selected', options.items.value.find((item) => item.id === value) || null)
}
watch(
  () => [props.systemId, props.resourceType, props.kind],
  () => {
    options.clear()
    emit('update:modelValue', '')
    emit('selected', null)
  },
  { immediate: true },
)
</script>

<template>
  <ElSelect
    :id="id"
    :model-value="modelValue"
    filterable
    remote
    clearable
    :remote-method="options.search"
    :loading="options.loading.value"
    :disabled="disabled"
    placeholder="搜索名称或标识"
    :no-data-text="options.failed.value ? '加载失败，请重新搜索' : '没有匹配项，请先登记并等待生效'"
    @update:model-value="select"
    @visible-change="
      (visible: boolean) => {
        if (visible) void options.load()
      }
    "
  >
    <ElOption
      v-for="item in options.items.value"
      :key="item.id"
      :value="item.id"
      :label="label(item)"
      :disabled="!ready(item)"
    />
    <template #footer>
      <ElButton
        v-if="options.items.value.length < options.total.value"
        text
        :loading="options.loading.value"
        @click="options.load(true)"
        >加载更多（{{ options.items.value.length }}/{{ options.total.value }}）</ElButton
      >
      <ElButton v-else-if="options.failed.value" text @click="options.load()">重新加载</ElButton>
      <span v-else class="authz-help">仅可选择已生效的对象</span>
    </template>
  </ElSelect>
</template>
