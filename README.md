# OlixOps Permission Center Web

独立权限中心的管理前端。当前已实现用户名密码登录、身份确认、账号概览、刷新恢复会话、退出登录，以及认证失效处理。租户、系统、管理员和审计的管理页面将在后续接入；当前不展示虚构统计或占位导航。

开发前阅读 [AGENTS.md](AGENTS.md)。后端仓库为 [olixops-permission-center](https://github.com/Vincentenxy/olixops-permission-center)。项目内携带 [Apple 设计及组件细节 skills](.agents/skills/README.md)，固定上游提交并保留 MIT 许可证。新电脑开发步骤见 [跨电脑工作区](design/workspace.md)，克隆后无需预先全局安装 skill。

本次交付基线、尚未验证的环境和后续功能统一见后端的 [开发交接清单](https://github.com/Vincentenxy/olixops-permission-center/blob/main/design/handoff.md)；本地文件为后端仓库的 `design/handoff.md`。

## 启动与联调

需要 Node.js 20.9+（推荐 Node.js 22）和 pnpm 10.11.1。首次安装使用固定版本：

```bash
corepack enable
corepack prepare pnpm@10.11.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

如果本机没有 Corepack，也可使用 `npx --yes pnpm@10.11.1 install --frozen-lockfile` 和 `npx --yes pnpm@10.11.1 dev`，不依赖全局 pnpm 版本。

开发地址为 `http://127.0.0.1:5173`，`/api` 默认代理到 `http://127.0.0.1:8080`。后端需按其 README 创建 PostgreSQL 表、配置 RSA JWT 签名密钥，并通过后端初始化命令创建管理员账号。前端不内置默认账号、密码或模拟登录接口。

如需修改开发代理，复制 `.env.example` 为 `.env.local`，设置 `API_PROXY_TARGET`。它仅由 Vite 开发服务读取。不要往 `VITE_*` 变量中放入密码、JWT、系统 Token 或数据库连接信息；这些值会进入浏览器构建产物。

## 认证与 API

| 请求                          | 请求内容                        | 响应 data                                  |
| ----------------------------- | ------------------------------- | ------------------------------------------ |
| `POST /api/v1/pub/auth/login` | `{ username, password }`        | `{ accessToken, expiresAt, user }`         |
| `GET /api/v1/auth/me`         | `Authorization: Bearer <token>` | `{ userId, username, name, platformRole }` |

登录返回的 `user` 与 `/auth/me` 的用户结构相同，`expiresAt` 为 RFC3339 时间。响应统一为 `{ code, msg, data }`；成功 `code=0`，普通业务错误默认 `code=-1`，HTTP 失败保留真实状态。

`platformRole` 是 `platform_admin` 或 `none`；`none` 不能被前端直接解释为租户管理员，租户管理员身份必须由后续真实成员接口确认。系统认证 Token 与管理员登录 JWT 是不同凭证，系统 Token 只能由所属租户的管理员创建。

- 唯一 Axios 实例在 `src/api/http.ts`。页面和 store 只调用已封装的 API，不直接发 HTTP 请求；API 层不依赖 store。
- 普通业务、HTTP 和网络错误统一包装为 `ApiError` 并提示一次。页面 catch 只更新状态，禁止重复弹错。
- 登录和会话恢复明确使用 `silent:true`，错误由表单或重试区域内联显示。登录 401 表示凭据不正确，不触发跳转循环；受保护请求的 401 即使 silent 也会清理凭证并回到登录。
- JWT 只保存在当前标签页的 `sessionStorage`，浏览器禁止存储时退化为内存会话。关闭标签页会结束持久化会话，不在标签页间同步登录。刷新时必须调用 `/auth/me` 重新确认身份，不从 JWT 解码推断角色。
- 退出登录是当前标签页的本地退出，清理 token、用户和待处理请求；不声称已经撤销服务器上仍未过期的 JWT。密码只存在登录表单局部状态，不进入 store 或持久化存储。
- 请求取消和会话版本检查防止退出后迟到响应重新登录；旧会话的 401 不能退出后来建立的新会话。返回地址只允许已实现的内部工作空间路径。
- 503 或网络失败展示重试状态，不能伪装为认证失效，也不能展示尚未确认的账号信息。

分页公共类型为 `PageRequest { pageNum?, pageSize? }` 和 `PageResp<T> { total, list }`。后端负责归一化 pageNum/pageSize 为 1/20，上限 200；响应不回显分页参数，空列表用 `[]`。当前登录阶段没有分页接口调用。

## 目录与设计

```text
src/
├── api/                 # 唯一 HTTP 实例、认证 API
├── assets/styles/       # 设计变量、公共控件、页面样式
├── components/common/   # 品牌等无业务依赖组件
├── router/              # 路由、认证守卫、页面标题
├── stores/              # 共享认证会话
├── types/               # API / 分页 / 认证类型
├── utils/               # 令牌存储、通知、安全返回地址
└── views/               # 登录和账号工作空间
tests/                   # 请求层、会话、登录、路由行为测试
deploy/                  # Nginx 同源代理模板
.agents/skills/          # 可随仓库携带的设计 skills
```

使用 Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、Axios 和 Sass。运行与工具依赖以 `package.json` 和 `pnpm-lock.yaml` 为准；没有为简单登录交互引入动画库。Element Plus 按需导入按钮与提示，表单保持原生 label、autocomplete 和键盘操作。

UI 以系统字体、浅灰底色、克制的蓝色强调、适量留白和玻璃顶栏呈现 Apple 风格。统一变量位于 `tokens.scss`，共享控件位于 `components.scss`。按压反馈不延迟请求、不阻塞键盘操作，支持减少动画、减少透明度和增强对比度偏好。错误内联且有可访问提示，密码图标保留 aria-label 和 aria-pressed；所有请求均有 loading，提交时禁止重复提交。

## 构建与部署

```bash
pnpm check
pnpm build
docker build -t olixops-permission-center-web:local .
docker run --rm -p 8088:80 -e API_UPSTREAM=http://host.docker.internal:8080 olixops-permission-center-web:local
```

开发和生产都使用同源 `/api`，浏览器不直接连接 PostgreSQL 或 SpiceDB。生产 Nginx 的 `API_UPSTREAM` 应指向后端 Service，例如 `http://olixops-permission-center:8080`。不要以尾部 `/` 改变代理路径。Kubernetes 环境使用 Service DNS 并在 Ingress / Higress 配置 HTTPS；浏览器凭证通过 HTTPS 传输。

Nginx 提供 history 路由回退、带 hash 静态资源缓存和安全响应头，API 请求直接代理并保留真实 HTTP 错误；生产构建不生成 sourcemap，Nginx 同时拒绝 `.map` 与隐藏文件访问。`pnpm preview` 只用于检查静态构建，不包含开发代理，真实接口联调使用 `pnpm dev` 或 Nginx 容器。

部署在 Nginx/Higress 后时，还应按后端 README 配置 `HTTP_TRUSTED_PROXIES` 为实际代理地址范围，让登录限流识别真实客户端；默认不会信任转发头，也不要把任意来源都配置为可信。

## 验证

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm check
git diff --check
```

`pnpm check` 依次执行 ESLint、Vitest、vue-tsc / TypeScript 检查与 Vite 生产构建。测试覆盖统一提示一次、silent、登录失败、受保护接口 401、迟到请求、表单校验、loading、重复提交、会话恢复和安全跳转。CI 使用同一命令和 frozen lockfile，不安装 Git 钩子。

本次初始化实际验证：

- `pnpm check` 通过：5 个测试文件、34 个行为测试、ESLint、应用与配置类型检查、生产构建均通过。
- `pnpm audit` 返回 0 个已知漏洞，运行依赖与开发依赖均已检查；测试工具使用修复后的 Vitest 4.1.11。
- 使用隔离 PostgreSQL 与真实 Go 后端完成浏览器联调：错误密码仅显示一条内联错误、正确登录、刷新恢复身份、退出，以及退出后直接访问 `/workspace` 返回登录。
- 检查桌面与 390×844 窄屏的登录和账号页面；浏览器控制台没有 error / warn。
- 容器构建和 Kubernetes 部署未在本次前端检查中执行；上述浏览器联调使用 Vite 开发代理，不能替代部署环境验证。
