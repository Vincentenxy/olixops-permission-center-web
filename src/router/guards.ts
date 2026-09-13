import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { loginDestination } from '../utils/redirect'

export function installGuards(router: Router, pinia: Pinia): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore(pinia)
    if (auth.token) await auth.restore()
    if (to.meta.requiresAuth && !auth.token) {
      return { name: 'Login', query: { redirect: to.path } }
    }
    if (to.name === 'Login' && auth.token) return loginDestination(to.query.redirect)
  })
  router.afterEach((to) => {
    document.title = `${String(to.meta.title || '权限中心')} · OlixOps`
  })
}
