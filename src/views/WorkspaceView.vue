<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Activity, ArrowRight, Building2, KeyRound, Users } from '@lucide/vue'
import { ElButton } from 'element-plus'
import PageHeader from '../components/common/PageHeader.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const displayName = computed(() => auth.user?.name || auth.user?.username || '管理员')
const isPlatformAdmin = computed(() => auth.user?.platformRole === 'platform_admin')
const destinations = computed(() => [
  {
    name: 'Tenants',
    label: '租户',
    description: '查看隔离边界和租户管理员',
    icon: Building2,
    visible: true,
  },
  {
    name: 'Users',
    label: '管理员',
    description: '维护后台账号和平台角色',
    icon: Users,
    visible: isPlatformAdmin.value,
  },
  {
    name: 'Systems',
    label: '系统接入',
    description: '维护调用账号和固定 Token',
    icon: KeyRound,
    visible: true,
  },
  {
    name: 'Audits',
    label: '审计',
    description: '追踪管理操作和请求标识',
    icon: Activity,
    visible: true,
  },
])
</script>

<template>
  <div class="management-page overview-page">
    <PageHeader :title="`你好，${displayName}`" description="当前账号已通过后端实时状态确认。">
      <template #actions>
        <ElButton :loading="auth.loading" @click="auth.refresh">刷新身份</ElButton>
      </template>
    </PageHeader>

    <section class="identity-panel">
      <div class="identity-avatar">{{ displayName.slice(0, 1).toUpperCase() }}</div>
      <div class="identity-copy">
        <h2>{{ displayName }}</h2>
        <p>{{ auth.user?.username }}</p>
      </div>
      <StatusBadge :status="auth.user?.platformRole || 'none'" />
      <dl>
        <div>
          <dt>用户 ID</dt>
          <dd class="monospace">{{ auth.user?.userId }}</dd>
        </div>
        <div>
          <dt>身份状态</dt>
          <dd>已验证</dd>
        </div>
      </dl>
    </section>

    <section class="workspace-links" aria-labelledby="workspace-links-title">
      <div class="section-heading">
        <div>
          <h2 id="workspace-links-title">管理入口</h2>
          <p>进入当前账号可见的管理范围。</p>
        </div>
      </div>
      <RouterLink
        v-for="item in destinations.filter((entry) => entry.visible)"
        :key="item.name"
        :to="{ name: item.name }"
        class="workspace-link"
      >
        <span class="workspace-link-icon"><component :is="item.icon" aria-hidden="true" /></span>
        <span
          ><strong>{{ item.label }}</strong
          ><small>{{ item.description }}</small></span
        >
        <ArrowRight aria-hidden="true" />
      </RouterLink>
    </section>
  </div>
</template>
