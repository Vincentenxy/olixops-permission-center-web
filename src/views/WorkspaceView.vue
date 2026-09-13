<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import 'element-plus/theme-chalk/el-button.css'
import AppBrand from '../components/common/AppBrand.vue'
import BrandMark from '../components/common/BrandMark.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const displayName = computed(() => auth.user?.name || auth.user?.username || '管理员')
const role = computed(() =>
  auth.user?.platformRole === 'platform_admin' ? '平台超级管理员' : '普通平台账号',
)

async function logout(): Promise<void> {
  auth.logout()
  await router.replace({ name: 'Login' })
}
</script>

<template>
  <div class="workspace-page">
    <header class="site-header workspace-header glass-surface">
      <AppBrand />
      <ElButton class="secondary-action" @click="logout">退出登录</ElButton>
    </header>
    <main class="workspace-main">
      <div class="workspace-heading">
        <p class="eyebrow">你的工作空间</p>
        <h1>{{ auth.user ? `你好，${displayName}。` : '账号概览' }}</h1>
        <p>从这里了解当前账号与管理身份。</p>
      </div>

      <section
        v-if="auth.loading"
        class="session-state surface"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <BrandMark />
        <h2>正在确认你的身份…</h2>
        <p>账号信息加载后会显示在这里。</p>
      </section>
      <section
        v-else-if="auth.sessionError"
        class="session-state surface"
        aria-labelledby="retry-title"
      >
        <BrandMark />
        <h2 id="retry-title">暂时无法读取账号</h2>
        <p role="alert">{{ auth.sessionError }}</p>
        <ElButton type="primary" :loading="auth.loading" @click="auth.restore">重新加载</ElButton>
      </section>
      <template v-else-if="auth.user">
        <section class="account-card surface" aria-labelledby="account-title">
          <div class="account-heading">
            <div class="account-avatar" aria-hidden="true">
              {{ displayName.slice(0, 1).toUpperCase() }}
            </div>
            <div>
              <h2 id="account-title">{{ displayName }}</h2>
              <span class="role-badge">{{ role }}</span>
            </div>
            <span class="verified-badge"><span></span>身份已验证</span>
          </div>
          <dl class="account-details">
            <div>
              <dt>登录账号</dt>
              <dd>{{ auth.user.username }}</dd>
            </div>
            <div>
              <dt>账号 ID</dt>
              <dd class="monospace">{{ auth.user.userId }}</dd>
            </div>
            <div>
              <dt>平台角色</dt>
              <dd>{{ role }}</dd>
            </div>
          </dl>
          <div class="account-footer">
            <p>账号信息来自当前登录会话。</p>
            <ElButton
              class="secondary-action"
              :loading="auth.loading"
              :disabled="auth.loading"
              @click="auth.refresh"
            >
              刷新信息
            </ElButton>
          </div>
        </section>
        <aside class="workspace-note">
          <BrandMark />
          <div>
            <h2>清晰的身份，独立的权限</h2>
            <p>租户管理权限以管理员分配为准。系统接入 Token 由所属租户的管理员创建。</p>
          </div>
        </aside>
      </template>
    </main>
    <footer class="site-footer">
      <span>OlixOps Permission Center</span><span>你的每一次访问，都有所归属。</span>
    </footer>
  </div>
</template>
