<script setup lang="ts">
import type { OperationState } from '../../types/authorization'
import { operationLabels } from '../../utils/authorization'
defineProps<{ state: OperationState | 'pending' }>()
</script>

<template>
  <span :class="['authz-status', `authz-status--${state}`]">
    <span aria-hidden="true" />{{ state === 'pending' ? '待生效' : operationLabels[state] }}
  </span>
</template>
