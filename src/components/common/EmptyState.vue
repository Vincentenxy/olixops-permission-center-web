<script setup lang="ts">
import { Inbox } from '@lucide/vue'

defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="empty-state">
    <Inbox aria-hidden="true" />
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </div>
</template>
