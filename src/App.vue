<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import BrandMark from './components/common/BrandMark.vue'

const auth = useAuthStore()
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <main v-else class="app-loading" role="status" aria-live="polite" :aria-busy="auth.loading">
      <BrandMark />
      <p>正在打开工作空间…</p>
    </main>
  </RouterView>
</template>
