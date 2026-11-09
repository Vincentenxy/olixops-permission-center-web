<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  AuthorizationResource,
  AuthorizationSubject,
  PermissionQuery,
  ResourceAction,
  ResourceType,
} from '../../types/authorization'
import DirectorySelect from './DirectorySelect.vue'

type Option = AuthorizationSubject | AuthorizationResource | ResourceAction | ResourceType
const props = defineProps<{ systemId: string; disabled: boolean; idPrefix: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: PermissionQuery | null] }>()
const subjectId = ref('')
const typeId = ref('')
const resourceId = ref('')
const actionId = ref('')
const subject = ref<AuthorizationSubject | null>(null)
const resourceType = ref<ResourceType | null>(null)
const resource = ref<AuthorizationResource | null>(null)
const action = ref<ResourceAction | null>(null)
function selectSubject(row: Option | null): void {
  subject.value = row && 'subjectType' in row ? row : null
}
function selectType(row: Option | null): void {
  resourceType.value = row && 'resourceCount' in row ? row : null
}
function selectResource(row: Option | null): void {
  resource.value = row && 'resourceType' in row && 'externalId' in row ? row : null
}
function selectAction(row: Option | null): void {
  action.value = row && 'resourceType' in row && 'code' in row ? row : null
}
const query = computed<PermissionQuery | null>(() => {
  if (
    !subject.value ||
    !resource.value ||
    !action.value ||
    !resourceType.value ||
    resource.value.resourceType !== resourceType.value.code ||
    action.value.resourceType !== resourceType.value.code
  )
    return null
  return {
    subject: { type: subject.value.subjectType, id: subject.value.externalId },
    resource: { type: resource.value.resourceType, id: resource.value.externalId },
    action: action.value.code,
  }
})
watch(query, (value) => emit('update:modelValue', value), { immediate: true })
</script>

<template>
  <div class="authz-permission-fields">
    <label :for="`${idPrefix}-subject`"
      >业务主体<DirectorySelect
        :id="`${idPrefix}-subject`"
        v-model="subjectId"
        kind="subjects"
        :system-id="props.systemId"
        :disabled="disabled"
        @selected="selectSubject"
    /></label>
    <label :for="`${idPrefix}-type`"
      >资源类型<DirectorySelect
        :id="`${idPrefix}-type`"
        v-model="typeId"
        kind="types"
        :system-id="props.systemId"
        :disabled="disabled"
        @selected="selectType"
    /></label>
    <label :for="`${idPrefix}-resource`"
      >资源实例<DirectorySelect
        :id="`${idPrefix}-resource`"
        v-model="resourceId"
        kind="resources"
        :system-id="props.systemId"
        :resource-type="resourceType?.code || ''"
        :disabled="disabled || !resourceType"
        @selected="selectResource"
    /></label>
    <label :for="`${idPrefix}-action`"
      >动作<DirectorySelect
        :id="`${idPrefix}-action`"
        v-model="actionId"
        kind="actions"
        :system-id="props.systemId"
        :resource-type="resourceType?.code || ''"
        :disabled="disabled || !resourceType"
        @selected="selectAction"
    /></label>
  </div>
</template>
