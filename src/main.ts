import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { installGuards } from './router/guards'
import { useAuthStore } from './stores/auth'
import { onSessionInvalidated } from './utils/token'
import 'element-plus/theme-chalk/base.css'
import './assets/styles/main.scss'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
installGuards(router, pinia)
onSessionInvalidated(() => {
  useAuthStore(pinia).logout()
  const current = router.currentRoute.value
  if (current.name !== 'Login') {
    void router.replace({ name: 'Login', query: { reason: 'expired', redirect: current.path } })
  }
})
app.use(router)
app.mount('#app')
