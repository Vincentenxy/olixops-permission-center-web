# Olixops Permission Center Web 开发规范

> 本文件是本仓库唯一的 Agent 规范入口。所有开发者和 Agent 开发前必须完整阅读本文件、[README.md](README.md) 和 [界面设计规范](design/DESIGN.md)。不维护重复的 `AGENT.md`。

## 项目范围与跨电脑协作

- 这是独立权限中心前端，后端仓库为 `https://github.com/Vincentenxy/olixops-permission-center`。Env Vault 仅是技术和交互规范参考，不是本项目的后端，不复制其主密钥、Secret、专用错误码或权限占位模型。
- 仓库内配置、相对路径文档、锁文件和 `.agents/skills/` 是跨电脑开发依据，不依赖某位开发者的绝对路径或本机已安装 skill。工作区装配方法见 [跨电脑开发](design/workspace.md)。
- 修改前检查 Git 状态并保留已有修改。前后端契约变更必须同时核对 Go 路由、Handler/DTO、OpenAPI、前端 API/类型和测试；后端数据库设计与审批以其 `AGENTS.md` 为准。
- README 记录当前实现，设计文档记录契约，计划不作为功能已完成的证据。用户当前要求前端先完成真实登录、身份恢复和退出，后续管理页面按确认的需求开发。

## 架构与复用

- Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、Axios、Sass；版本以本仓库 `package.json` 和 `pnpm-lock.yaml` 为准。
- HTTP 只能通过 `src/api/http.ts` 的统一实例发出，业务 API 在 `src/api/` 封装。页面、store、composable 不得新增请求实例，`api/` 不依赖 store。
- 跨页面认证状态和远端缓存放 `stores/`，表单、弹框、临时查询结果在页面局部保存，可复用逻辑放 `composables/`，通用组件不依赖业务 store。
- 同一功能和规则只写一处。新增逻辑先搜索现有能力，复用统一认证、请求、错误、分页和样式；语义不同的业务不强行塞进万能组件或通用 CRUD。
- 组件使用 `<script setup lang="ts">`，组件文件、类型和路由 name 用 PascalCase，工具/API/store/composable 文件用 kebab-case，字段 camelCase。未知数据使用 `unknown` 并收窄，避免 `any`。
- 格式遵循 `.prettierrc.json`：2 空格、单引号、无分号、行宽 100。只格式化修改范围，不安装提交钩子。

## 认证与安全

- 登录使用 `POST /api/v1/pub/auth/login` 的用户名密码；管理员使用 Bearer JWT。`GET /api/v1/auth/me` 返回后端验证的用户信息，前端不得靠解码 JWT 推断管理权。
- 系统 API Token 与管理员 JWT 是不同凭据；系统 Token 不能用来登录后台。系统 Token 只能由该系统所属租户的有效管理员创建，平台超管角色本身不提供此权限；最终校验由后端执行。
- 登录 JWT 仅通过统一 token 工具与认证 store 管理。本期会话限于当前浏览器标签页，刷新后重新向后端确认用户状态；退出或 401 时清理凭据、身份及未完成请求，迟到的请求不得恢复已退出状态。
- 密码不持久化，离开登录页面清理；JWT、系统密钥、密码不进入日志、console、URL、history state、测试快照或错误消息。禁止把秘密写入 `VITE_*`，它们会被打包进浏览器。
- 跳转目标必须是本应用内部地址，禁止开放重定向。后端不可用时展示可重试错误，不伪装成登录成功或权限拒绝。页面隐藏操作不能替代后端授权。
- 开发和测试仅使用虚构凭据。外链使用 `noopener noreferrer`。生产构建不发布源码映射；服务器访问控制才是隐藏源码文件的保障。

## API 与错误处理

- `/api/v1` 为统一前缀，`/pub/` 为公开路由；无参查询 GET，带参查询与变更 POST + JSON。响应 `{code,msg,data}`，成功 0、普通业务失败 -1，HTTP 失败保留真实状态和统一结构。
- 分页请求为 `pageNum/pageSize`，默认 1/20、最大 200，由后端 Handler 归一化；响应 `{total,list}`，不回显页码/条数，空列表 `[]`。页面使用本地请求状态维护分页。
- 请求层统一生成 `ApiError` 并通过通知工具提示一次。页面和 store 捕获普通 API 错误后只更新状态、结束 loading、保留输入，不重复弹错。
- 登录表单等明确局部展示错误的场景可使用 `silent`；它只关闭全局提示，不绕过受保护请求的 401 清理和跳转。登录失败应在表单内解释，不产生循环跳转。
- 403、404、409、502/503/504 等分别保留含义；不引入 Env Vault 的 `code=-2` 或 `/masterKey` 跳转，不自动重试创建/授权请求。
- 所有请求提供局部 loading，通过 `try/finally` 关闭；操作按钮 loading 且禁止重复提交，并发区域分别处理。不用人为延时模拟请求或最低 loading 时长。

## 界面与设计 skill

- 本项目使用 Apple 风格：系统字体、清晰文字层级、克制色彩、适量半透明层次、明确反馈和充足留白。实际实现以 [design/DESIGN.md](design/DESIGN.md) 和公共样式 token 为准。
- 开始 UI 或交互工作前完整阅读仓库内 [apple-design](.agents/skills/apple-design/SKILL.md)；涉及组件细节或动画同时阅读 [emil-design-eng](.agents/skills/emil-design-eng/SKILL.md)。不要求联网安装最新版；固定上游版本与许可证见 [.agents/skills/README.md](.agents/skills/README.md)。
- Skill 的 React/Swift 示例只借鉴原则，本仓库使用 Vue。用户明确要求和本仓库认证、安全、loading 规范优先，不因动画而解除提交防重复控制。
- 主题颜色、圆角、阴影和间距集中在 `src/assets/styles/`，不能为不同页面复制相同规则。弹框圆角 16px；底部按钮高 32px、最小宽 58px、水平 padding 16px、间距 10px、圆角 16px。普通确认蓝色 `#176dfb`，危险操作用 danger 红色。
- 二次确认使用 Element Plus 统一封装/公共类，不手写重复确认弹窗；提交时确认展示 loading、取消禁用。
- 眼睛、编辑、删除等常见图标不重复 Tooltip，但必须有 `aria-label`，切换按钮维护 `aria-pressed`。仅有歧义或包含额外重要信息时使用 Tooltip。
- 保留键盘访问、明确 focus、表单 label 和错误关联。支持窄屏、大字体、减少动画、减少透明度与更高对比度；动效不得阻碍输入，hover 效果限精确指针设备。

## 验证与交付

- 使用声明的 pnpm 版本与锁文件；CI/新电脑用 `pnpm install --frozen-lockfile`。新增依赖说明用途，禁止仅为简单视觉效果引入整套框架。
- 业务代码/请求层/类型/路由/构建变更运行 `pnpm check`（lint、Vitest、生产构建和类型检查）。不得忽略源码或关闭规则制造通过结果。
- 认证测试至少覆盖正确/错误登录、依赖失败、刷新恢复、401 失效、退出后的迟到响应、站内跳转约束；请求层覆盖普通失败只提示一次、silent 和 HTTP 状态处理。
- UI 完成后检查桌面与窄屏，验证 loading、错误、重复提交、键盘操作与退出行为；mock 测试不等于真实前后端联调。
- 纯文档改动检查相对链接、契约示例和 `git diff --check`；YAML 同时验证解析。交付如实列出改动仓库、检查结果和未实现项。
