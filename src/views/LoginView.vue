<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import 'element-plus/theme-chalk/el-button.css'
import AppBrand from '../components/common/AppBrand.vue'
import BrandMark from '../components/common/BrandMark.vue'
import { ApiError, isRequestCanceled } from '../api/http'
import { useAuthStore } from '../stores/auth'
import { loginDestination } from '../utils/redirect'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const form = reactive({ username: '', password: '' })
const touched = reactive({ username: false, password: false })
const showPassword = ref(false)
const error = ref('')
const submitting = ref(false)
const usernameInput = ref<HTMLInputElement>()
const passwordInput = ref<HTMLInputElement>()
const usernameError = computed(() => touched.username && !form.username.trim())
const passwordError = computed(() => touched.password && !form.password)
let completed = false

async function submit(): Promise<void> {
  if (submitting.value) return
  touched.username = true
  touched.password = true
  error.value = ''
  if (usernameError.value || passwordError.value) {
    await nextTick()
    if (usernameError.value) usernameInput.value?.focus()
    else passwordInput.value?.focus()
    return
  }
  submitting.value = true
  try {
    await auth.login({ username: form.username.trim(), password: form.password })
    form.password = ''
    showPassword.value = false
    completed = true
    await router.replace(loginDestination(route.query.redirect))
  } catch (cause) {
    if (isRequestCanceled(cause)) return
    error.value =
      cause instanceof ApiError
        ? cause.status === 401
          ? '账号或密码不正确，请重新输入。'
          : cause.message
        : '暂时无法登录，请稍后重试。'
    passwordInput.value?.focus()
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  form.password = ''
  showPassword.value = false
  if (submitting.value && !completed) auth.logout()
})
</script>

<template>
  <div class="login-page">
    <header class="site-header">
      <AppBrand />
      <span class="header-caption">你的权限管理工作空间</span>
    </header>

    <main class="login-main">
      <section class="login-intro" aria-labelledby="product-title">
        <p class="eyebrow">ONE PLACE. CLEAR ACCESS.</p>
        <h1 id="product-title">各有所属。<br /><span>一处掌握。</span></h1>
        <p class="intro-description">连接你的租户与系统，<br />让每一份访问权限，都清晰有序。</p>
        <div class="access-illustration" aria-hidden="true">
          <div class="orbit orbit-outer"></div>
          <div class="orbit orbit-inner"></div>
          <span class="orbit-node node-one"></span>
          <span class="orbit-node node-two"></span>
          <span class="orbit-node node-three"></span>
          <div class="illustration-core"><BrandMark /></div>
          <span class="illustration-label label-one">租户</span>
          <span class="illustration-label label-two">系统</span>
          <span class="illustration-label label-three">访问权限</span>
        </div>
        <p class="intro-note">独立的租户边界，统一的管理体验。</p>
      </section>

      <section class="login-card surface" aria-labelledby="login-title">
        <div class="card-heading">
          <div class="login-icon"><BrandMark /></div>
          <p class="eyebrow">管理员登录</p>
          <h2 id="login-title">欢迎回来</h2>
          <p>登录账号，进入你的工作空间。</p>
        </div>
        <form novalidate :aria-busy="submitting" @submit.prevent="submit">
          <div class="form-field">
            <label for="username">账号</label>
            <input
              id="username"
              ref="usernameInput"
              v-model="form.username"
              name="username"
              type="text"
              autocomplete="username"
              autocapitalize="none"
              :spellcheck="false"
              placeholder="输入管理员账号"
              :disabled="submitting"
              :aria-invalid="usernameError"
              :aria-describedby="usernameError ? 'username-error' : undefined"
              @blur="touched.username = true"
            />
            <p v-if="usernameError" id="username-error" class="field-error">请输入账号。</p>
          </div>
          <div class="form-field">
            <label for="password">密码</label>
            <div class="password-field">
              <input
                id="password"
                ref="passwordInput"
                v-model="form.password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="输入登录密码"
                :disabled="submitting"
                :aria-invalid="passwordError"
                :aria-describedby="passwordError ? 'password-error' : undefined"
                @blur="touched.password = true"
              />
              <button
                class="password-toggle icon-button"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :aria-pressed="showPassword"
                :disabled="submitting"
                @click="showPassword = !showPassword"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" />
                  <path
                    v-if="showPassword"
                    d="m4 3 16 18"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
            </div>
            <p v-if="passwordError" id="password-error" class="field-error">请输入密码。</p>
          </div>
          <div class="login-feedback" aria-live="polite" aria-atomic="true">
            <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
            <p v-else-if="route.query.reason === 'expired'" class="session-notice">
              登录已失效，请重新登录。
            </p>
          </div>
          <ElButton
            class="login-submit"
            type="primary"
            native-type="submit"
            :loading="submitting"
            :disabled="submitting"
          >
            {{ submitting ? '正在登录…' : '登录工作空间' }}
            <svg v-if="!submitting" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </ElButton>
        </form>
        <p class="login-help">需要账号或忘记密码？请联系平台管理员。</p>
      </section>
    </main>

    <footer class="site-footer">
      <span>OlixOps Permission Center</span>
      <span>让访问，恰到好处。</span>
    </footer>
  </div>
</template>
