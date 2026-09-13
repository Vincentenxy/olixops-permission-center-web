import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/workspace' },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/workspace',
      name: 'Workspace',
      component: () => import('../views/WorkspaceView.vue'),
      meta: { title: '我的工作空间', requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/workspace' },
  ],
})
