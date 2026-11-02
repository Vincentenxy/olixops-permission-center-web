<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  Activity,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from '@lucide/vue'
import { ElButton, ElDrawer } from 'element-plus'
import { ref } from 'vue'
import AppBrand from './AppBrand.vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const isPlatformAdmin = computed(() => auth.user?.platformRole === 'platform_admin')
const displayName = computed(() => auth.user?.name || auth.user?.username || '管理员')

const navigation = computed(() => [
  { name: 'WorkspaceHome', label: '概览', icon: LayoutDashboard, visible: true },
  { name: 'Tenants', label: '租户', icon: Building2, visible: true },
  { name: 'Users', label: '管理员', icon: Users, visible: isPlatformAdmin.value },
  { name: 'Systems', label: '系统接入', icon: KeyRound, visible: true },
  { name: 'Audits', label: '审计', icon: Activity, visible: true },
])

function isActive(name: string): boolean {
  return route.name === name
}

async function logout(): Promise<void> {
  auth.logout()
  await router.replace({ name: 'Login' })
}

function closeMobile(): void {
  mobileOpen.value = false
}
</script>

<template>
  <div class="management-shell">
    <aside class="management-sidebar">
      <div class="sidebar-brand"><AppBrand /></div>
      <nav aria-label="主导航" class="sidebar-nav">
        <RouterLink
          v-for="item in navigation.filter((entry) => entry.visible)"
          :key="item.name"
          :to="{ name: item.name }"
          :class="['sidebar-link', { active: isActive(item.name) }]"
        >
          <component :is="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-account">
        <div class="account-identity">
          <span class="account-initial">{{ displayName.slice(0, 1).toUpperCase() }}</span>
          <span
            ><strong>{{ displayName }}</strong
            ><small>{{ auth.user?.username }}</small></span
          >
        </div>
        <ElButton class="icon-button" text aria-label="退出登录" @click="logout">
          <LogOut aria-hidden="true" />
        </ElButton>
      </div>
    </aside>

    <header class="mobile-header glass-surface">
      <AppBrand />
      <ElButton class="icon-button" text aria-label="打开导航" @click="mobileOpen = true">
        <Menu aria-hidden="true" />
      </ElButton>
    </header>

    <ElDrawer
      v-model="mobileOpen"
      direction="ltr"
      size="min(84vw, 320px)"
      :with-header="false"
      class="mobile-navigation-drawer"
    >
      <div class="mobile-drawer-heading">
        <AppBrand />
        <ElButton class="icon-button" text aria-label="关闭导航" @click="closeMobile">
          <X aria-hidden="true" />
        </ElButton>
      </div>
      <nav aria-label="移动端主导航" class="sidebar-nav">
        <RouterLink
          v-for="item in navigation.filter((entry) => entry.visible)"
          :key="item.name"
          :to="{ name: item.name }"
          :class="['sidebar-link', { active: isActive(item.name) }]"
          @click="closeMobile"
        >
          <component :is="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-account mobile-account">
        <div class="account-identity">
          <span class="account-initial">{{ displayName.slice(0, 1).toUpperCase() }}</span>
          <span
            ><strong>{{ displayName }}</strong
            ><small>{{ auth.user?.username }}</small></span
          >
        </div>
        <ElButton class="icon-button" text aria-label="退出登录" @click="logout">
          <LogOut aria-hidden="true" />
        </ElButton>
      </div>
    </ElDrawer>

    <main class="management-content"><RouterView /></main>
  </div>
</template>
