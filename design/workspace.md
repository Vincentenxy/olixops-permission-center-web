# 跨电脑开发

## 仓库布局

将两个仓库放在同一父目录，例如 `permission-workspace/`。运行时配置单独从自己的环境准备，真实密钥和数据库密码不进 Git。

```sh
git clone https://github.com/Vincentenxy/olixops-permission-center.git
git clone https://github.com/Vincentenxy/olixops-permission-center-web.git
```

```text
permission-workspace/
├── olixops-permission-center/       # Go 后端、数据库 SQL、OpenAPI
└── olixops-permission-center-web/   # Vue 前端、设计规范与 skills
    └── permission-center.code-workspace
```

在 VS Code 打开本仓库根目录的 `permission-center.code-workspace` 即可同时看到前后端。现有电脑若两个仓库不在同一父目录，可在本地工作区手动选择它们，不把个人盘符写进项目规范。

## 新电脑启动顺序

1. 安装后端 `go.mod` 声明的 Go、前端 `package.json` 要求的 Node 与 pnpm。版本跟随仓库，不依赖全局“最新版”。
2. 先读两个仓库各自的 `AGENTS.md` 与 README。后端数据库的建库、用户授权及七表 SQL 在 `design/database.md`，按文档手动执行；服务不会自动建表。
3. 按后端 README 生成本地 RSA 密钥，配置 PostgreSQL 连接和 JWT issuer/audience，离线初始化首个超管，再启动后端。Redis 和 SpiceDB 均不是本期登录的前置条件。
4. 前端执行 `pnpm install --frozen-lockfile`，按 README 设置开发代理后运行 `pnpm dev`。使用刚创建的管理员登录；密码只在自己的环境中输入。
5. 修改后在后端运行 `go vet ./...`、`go test ./...`、`go build ./...`，在前端运行 `pnpm check`；接口变更需在两个仓库同步验证。

## 新电脑的设计 skills

本项目实际使用的 `apple-design` 与 `emil-design-eng` 已完整保存在 `.agents/skills/`，包含上游固定提交与 MIT 许可证。根 `AGENTS.md` 要求后续 Agent 按任务读取这些相对路径，因此不依赖本机全局安装或联网下载。

开始界面开发前，按 [设计 skills 安装与验证](../.agents/skills/README.md) 检查文件和个人安装情况。该文档是安装步骤的唯一维护位置，包含 macOS/Linux 与 Windows PowerShell 的离线安装、`CODEX_HOME` 目录选择、已有版本处理和一致性验证。

新电脑缺少全局 skills 时可直接从仓库副本安装；网络不可用也能沿用同一版本。项目设计依据为 [design/DESIGN.md](DESIGN.md) 和公共样式 token，Agent 必须读取本项目副本，不因全局缺失或版本不同改变界面风格。

## 配置边界

- 前端 `.env.example` 只含公开配置或开发代理地址，不包含数据库凭据、系统密钥或 JWT 私钥。
- 后端真实 `config/config.yaml`、PEM/KEY、`.env` 和开发缓存均不提交；克隆后按安全模板创建自己的配置。
- Git 中包含源码、锁文件、SQL 文档、API 契约、开发规范、skill、部署模板与验证命令；运行中的数据库数据及私人凭据由部署环境维护。
- 前端生产环境通过同源反向代理访问 `/api`；跨主机部署需要在自己的网关配置后端地址和 HTTPS。
