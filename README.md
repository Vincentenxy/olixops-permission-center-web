# OlixOps Permission Center Web

独立权限中心的管理前端。当前已实现用户名密码登录、身份恢复、租户与租户管理员、平台管理员、接入系统与固定 Token、管理审计，以及认证失效处理。平台超管可维护全局资源，租户管理员只能看到后端授权范围内的租户、系统和审计；页面不推断或扩大权限。

开发前阅读 [AGENTS.md](AGENTS.md)。后端仓库为 [olixops-permission-center](https://github.com/Vincentenxy/olixops-permission-center)。项目内携带 [Apple 设计及组件细节 skills](.agents/skills/README.md)，固定上游提交并保留 MIT 许可证。新电脑开发步骤见 [跨电脑工作区](design/workspace.md)，克隆后无需预先全局安装 skill。

前后端统一交接入口为后端的 [开发交接清单](https://github.com/Vincentenxy/olixops-permission-center/blob/main/design/handoff.md)，更新日期为 2026-11-06；本地文件为后端仓库的 `design/handoff.md`。待确认事项集中在那里维护，前端不另复制一份状态清单。

## 当前开发进度

截至 2026-11-06，管理前端代码已完成并接入后端既有 API；后端的 SpiceDB 部分完成设计与离线模型验证，业务授权接口及其前端页面尚未实现。

| 页面/能力 | 路径 | 当前实现与代码 |
|---|---|---|
| 登录 | `/login` | 用户名密码、内联错误、loading 和防重复；`src/views/LoginView.vue` |
| 概览 | `/workspace` | 当前账号信息、刷新身份、管理入口；`src/views/WorkspaceView.vue` |
| 租户与成员 | `/workspace/tenants` | 租户查询/创建/编辑/停用恢复、管理员关联与状态、按用户名远程搜索候选人；`src/views/TenantsView.vue` |
| 平台管理员 | `/workspace/users` | 用户查询/创建/编辑/停用恢复、平台角色设置；导航和路由限制平台超管；`src/views/UsersView.vue` |
| 系统接入 | `/workspace/systems` | 系统/账号状态、租户选择、固定 Token 资格查询/创建/吊销、明文仅一次展示；`src/views/SystemsView.vue` |
| 审计 | `/workspace/audits` | 按后端授权范围筛选、分页、详情；`src/views/AuditsView.vue` |
| 公共能力 | 各页面共用 | 统一 Axios/ApiError、一次错误提示、会话恢复与 401 清理、分页/取消、公共壳和样式 token |

已实现管理能力不等于已部署或已完成全部浏览器联调。登录/账号页面有真实后端浏览器验证记录；新增租户、管理员、系统、Token、审计管理流只完成自动化检查，仍需在实际后端/数据库环境验证桌面、窄屏、权限边界和错误状态。

尚未开发：业务主体、资源类型、动作、角色成员、资源登记、grant/revoke、权限测试、可靠写入任务状态和可访问资源列表页面；SSO/checkSelf、SDK、注册/找回密码、refresh token、跨设备撤销、Token 轮换也未实现。现有“租户管理员”是后台管理身份，不等同于未来 SpiceDB 的业务角色。

后端已完成的模型工作见 [权限模型 README](https://github.com/Vincentenxy/olixops-permission-center/blob/main/authorization/README.md)：独立 Schema、7 组快照、37 条断言，其中包含 4 条非法写入风险复现。它证明规则的离线计算行为，不代表前端已经能授权，或实际服务已具备隔离及在线撤权保证。浏览器不能持有 SpiceDB 服务凭据，也不能以系统 Token 代替管理员 JWT 操作后台或直接调用授权引擎。

## AI 接手顺序

1. 阅读本仓库 `AGENTS.md`、本 README、[设计规范](design/DESIGN.md)，再阅读后端 `AGENTS.md`、README 和统一交接清单。开始 UI 工作前读取仓库内设计 skills；不必重新初始化已存在页面。
2. 拉取前后端代码并检查各自 Git 状态。按 [工作区说明](design/workspace.md) 准备真实环境，勿依赖此前机器的端口、进程、临时账号或本地配置。
3. 先处理管理流真实环境验收；核心授权页面需等后端表设计审批及正式接口契约。当前 `permission.proto` 是占位，不据此构建可用授权页面或伪造 API。
4. 扩展接口时复用 [management.ts](src/api/management.ts) 的封装模式、[http.ts](src/api/http.ts) 的统一入口及 [use-paged-list.ts](src/composables/use-paged-list.ts)；类型集中维护，跨协议业务校验由后端负责。
5. 核心授权首个验收目标：租户管理员在系统 A 给主体授予 folder/read，后端 HTTP/gRPC 均允许；撤权任务生效后均拒绝。角色和范围继承、列表及 SSO 分阶段扩展，页面需区分待生效、正常无权与依赖不可用。
6. API 变更同步后端 OpenAPI、前端类型/API/测试，执行 `pnpm check`，完成真实浏览器验证，再分别提交两个仓库并更新统一交接清单。

## 换电脑继续当前设计

Apple 风格设计规则、`apple-design` / `emil-design-eng` 完整副本及 MIT 许可证均保存在 Git 中。新电脑先阅读 [设计规范](design/DESIGN.md)，再按 [skills 安装与验证说明](.agents/skills/README.md) 检查；缺少个人安装时可直接从仓库安装固定版本，文档同时提供 macOS/Linux 与 Windows PowerShell 命令。开发环境装配见 [跨电脑工作区](design/workspace.md)。

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

`platformRole` 是 `platform_admin` 或 `none`；`none` 不能被前端直接解释为租户管理员。租户列表由后端按管理范围过滤，系统页的租户选择对非平台超管使用 `/auth/tenant/list`，表示实际有效管理员关联。系统认证 Token 与管理员登录 JWT 是不同凭据，系统 Token 只能由所属租户的有效管理员创建，超管也不能绕过此条件。

- 唯一 Axios 实例在 `src/api/http.ts`。页面和 store 只调用已封装的 API，不直接发 HTTP 请求；API 层不依赖 store。
- 普通业务、HTTP 和网络错误统一包装为 `ApiError` 并提示一次。页面 catch 只更新状态，禁止重复弹错。
- 登录和会话恢复明确使用 `silent:true`，错误由表单或重试区域内联显示。登录 401 表示凭据不正确，不触发跳转循环；受保护请求的 401 即使 silent 也会清理凭证并回到登录。
- JWT 只保存在当前标签页的 `sessionStorage`，浏览器禁止存储时退化为内存会话。关闭标签页会结束持久化会话，不在标签页间同步登录。刷新时必须调用 `/auth/me` 重新确认身份，不从 JWT 解码推断角色。
- 退出登录是当前标签页的本地退出，清理 token、用户和待处理请求；不声称已经撤销服务器上仍未过期的 JWT。密码只存在登录表单局部状态，不进入 store 或持久化存储。
- 请求取消和会话版本检查防止退出后迟到响应重新登录；旧会话的 401 不能退出后来建立的新会话。返回地址只允许已实现的内部工作空间路径。
- 503 或网络失败展示重试状态，不能伪装为认证失效，也不能展示尚未确认的账号信息。

分页公共类型为 `PageRequest { pageNum?, pageSize? }` 和 `PageResp<T> { total, list }`。列表请求统一提交 `pageNum/pageSize`，后端负责归一化为 1/20、上限 200；响应只读取 `total/list`，不依赖后端回显分页参数，空列表用 `[]`。

管理页面统一通过 `src/api/management.ts` 调用后端既有接口。租户管理员范围使用 `/auth/tenant/list`，Token 创建入口使用 `/system/credential/checkCreate` 展示后端实时资格，前端状态不能替代写事务复查。创建系统 Token 时完整明文只在不可点击遮罩关闭的一次性对话框中短暂展示，关闭后立即清空；列表只保留 `keyId` 和状态等元数据。平台管理员页面同时受导航隐藏和路由守卫保护，实际授权仍以后端为准。

## 目录与设计

```text
src/
├── api/                 # 唯一 HTTP 实例、认证与管理 API
├── assets/styles/       # 设计变量、公共控件、页面样式
├── components/common/   # 应用壳、页面标题、状态、空态、敏感 Token 对话框
├── composables/         # 可复用分页列表状态与并发取消
├── router/              # 路由、认证守卫、页面标题
├── stores/              # 共享认证会话
├── types/               # API / 分页 / 认证 / 管理 DTO 类型
├── utils/               # 令牌存储、通知、安全返回地址
└── views/               # 登录、概览、租户、管理员、系统、审计
tests/                   # 请求层、会话、登录、路由行为测试
deploy/                  # Nginx 同源代理模板
.agents/skills/          # 可随仓库携带的设计 skills
```

使用 Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、Axios、Lucide 和 Sass。运行与工具依赖以 `package.json` 和 `pnpm-lock.yaml` 为准；没有为管理交互引入动画库。表单保持真实 label、自动填充语义和键盘操作，工具操作使用带可访问名称的 Lucide 图标。

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

历史代码交付的验证记录（本轮 2026-11-06 为文档整理，未据此宣称重新执行全部检查）：

- `pnpm check` 通过：6 个测试文件、41 个行为测试、ESLint、应用与配置类型检查、生产构建均通过。
- 历史初始化曾执行 `pnpm audit` 返回 0 个已知漏洞，管理页面交付也执行过 `pnpm audit --prod`；这不是 2026-11-06 的漏洞库复查结果，依赖以锁文件为准。
- 使用隔离 PostgreSQL 与真实 Go 后端完成浏览器联调：错误密码仅显示一条内联错误、正确登录、刷新恢复身份、退出，以及退出后直接访问 `/workspace` 返回登录。
- 原登录与账号页面已检查桌面及 390×844 窄屏；本次新增管理页面完成自动化检查和生产构建，仍需在连接真实后端后补充完整浏览器业务流验收。
- 容器构建和 Kubernetes 部署未在本次前端检查中执行；上述浏览器联调使用 Vite 开发代理，不能替代部署环境验证。

2026-11-06 本轮只整理 README、规范中的旧阶段描述及统一交接入口，未修改前端业务代码。文档相对链接、源码路径、前后端状态和 `git diff --check` 检查结果记录于后端统一交接清单；未启动或确认旧预览进程，不承诺本地预览地址持续可用。
