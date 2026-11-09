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
      component: () => import('../components/common/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'WorkspaceHome',
          component: () => import('../views/WorkspaceView.vue'),
          meta: { title: '概览', requiresAuth: true },
        },
        {
          path: 'tenants',
          name: 'Tenants',
          component: () => import('../views/TenantsView.vue'),
          meta: { title: '租户', requiresAuth: true },
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('../views/UsersView.vue'),
          meta: { title: '管理员', requiresAuth: true, platformAdmin: true },
        },
        {
          path: 'systems',
          name: 'Systems',
          component: () => import('../views/SystemsView.vue'),
          meta: { title: '系统接入', requiresAuth: true },
        },
        {
          path: 'authorization',
          name: 'Authorization',
          component: () => import('../views/AuthorizationView.vue'),
          meta: { title: '授权管理', requiresAuth: true },
        },
        {
          path: 'audits',
          name: 'Audits',
          component: () => import('../views/AuditsView.vue'),
          meta: { title: '审计', requiresAuth: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/workspace' },
  ],
})
