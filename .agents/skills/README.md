# 项目设计 skills

本目录包含项目实际使用的完整上游技能，不依赖个人电脑的全局安装。Agent 从根 [AGENTS.md](../../AGENTS.md) 进入，并按任务阅读对应 `SKILL.md`。

| Skill | 作用 |
|---|---|
| [apple-design](apple-design/SKILL.md) | 参考 Apple WWDC 的 Web 交互、即时反馈、材料与无障碍原则 |
| [emil-design-eng](emil-design-eng/SKILL.md) | 组件细节、动效选择、缓动、性能与交互品质 |

来源：[emilkowalski/skills](https://github.com/emilkowalski/skills)。固定提交：`d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7`；引入日期：2026-09-14。上游路径分别为 `skills/apple-design` 和 `skills/emil-design-eng`，文件未修改。许可为 [MIT](LICENSE)，保留原版权声明。

这是社区维护的 skills，并非 Apple 官方发布。官方设计参考为 [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)；页面布局与信息密度按本项目 [设计规范](../../design/DESIGN.md) 落地，React/Swift 示例只借鉴原则，代码仍使用 Vue。

2026-11-02 已重新检索 Skills 目录并核对来源，继续采用这两个适合 Web 的 skills。本机 Codex 全局目录已安装相同固定版本，项目副本保持不变；全局安装供其他项目使用，项目开发仍以仓库规范和本目录为依据。

## 新电脑检查与使用

从前端仓库根目录开始：

1. 阅读 [AGENTS.md](../../AGENTS.md) 和 [设计规范](../../design/DESIGN.md)，再按任务读取这两个 skill。页面风格与管理页面布局以项目规范为准，社区 skill 提供实现参考。
2. 确认本目录中的 `apple-design/SKILL.md`、`emil-design-eng/SKILL.md` 和 `LICENSE` 存在；它们都随 Git 提交，完整克隆后即可直接阅读，不需要先联网下载上游。
3. 如果希望 Codex 在其他项目中也能发现这些 skills，检查个人 skills 目录；缺少时按下文从仓库副本安装。已有同名版本时先比较，保留现有文件，不自动覆盖。
4. 安装后在下一轮检查是否能发现 skills；项目开发始终可以通过 `AGENTS.md` 中的相对路径读取仓库副本。全局版本不同或不可用时，继续按项目副本与设计规范开发。

## 从仓库副本安装到 Codex

使用项目已固定的版本，包含 MIT 许可证，无需访问 GitHub。以下命令均在**前端仓库根目录**运行。默认目录为个人目录下的 `.codex/skills`，设置了 `CODEX_HOME` 时使用其下的 `skills`；不在文档中写入某台电脑的绝对路径。

### macOS / Linux

```sh
design_skill_root="${CODEX_HOME:-$HOME/.codex}/skills"
mkdir -p "$design_skill_root"
for design_skill in apple-design emil-design-eng; do
  if [ -e "$design_skill_root/$design_skill" ]; then
    printf '%s\n' "$design_skill 已存在，保留并按下文比较版本。"
    continue
  fi
  cp -R ".agents/skills/$design_skill" "$design_skill_root/$design_skill"
  cp .agents/skills/LICENSE "$design_skill_root/$design_skill/LICENSE"
done
```

### Windows PowerShell

```powershell
$designSkillHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$designSkillRoot = Join-Path $designSkillHome 'skills'
New-Item -ItemType Directory -Force -Path $designSkillRoot | Out-Null
foreach ($designSkill in @('apple-design', 'emil-design-eng')) {
  $designSkillDestination = Join-Path $designSkillRoot $designSkill
  if (Test-Path -LiteralPath $designSkillDestination) {
    Write-Host "$designSkill 已存在，保留并按下文比较版本。"
    continue
  }
  Copy-Item -LiteralPath ".agents/skills/$designSkill" -Destination $designSkillDestination -Recurse
  Copy-Item -LiteralPath '.agents/skills/LICENSE' -Destination (Join-Path $designSkillDestination 'LICENSE')
}
```

### 安装验证与已有版本

安装完成后，每个目标目录应有 `SKILL.md` 与 `LICENSE`。比较以下两个 skill 文件；命令无输出且退出码为 0 表示一致，退出码为 1 表示存在内容差异：

macOS / Linux：

```sh
git diff --no-index -- .agents/skills/apple-design/SKILL.md "$design_skill_root/apple-design/SKILL.md"
git diff --no-index -- .agents/skills/emil-design-eng/SKILL.md "$design_skill_root/emil-design-eng/SKILL.md"
```

Windows PowerShell：

```powershell
git diff --no-index -- .agents/skills/apple-design/SKILL.md (Join-Path $designSkillRoot 'apple-design/SKILL.md')
git diff --no-index -- .agents/skills/emil-design-eng/SKILL.md (Join-Path $designSkillRoot 'emil-design-eng/SKILL.md')
```

发现差异时，项目继续读取仓库副本；若要更新全局版本，先比较并备份现有版本，再手动替换。不能为了本项目直接覆盖其他项目正在使用的全局 skill。

## 来源恢复与升级

若仓库副本缺失，先检查是否完整克隆或使用了稀疏检出，优先从本项目 Git 历史恢复。必须从上游恢复时，使用上文固定提交中的 [apple-design](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills/apple-design)、[emil-design-eng](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills/emil-design-eng) 和 [MIT 许可证](https://github.com/emilkowalski/skills/blob/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/LICENSE)，保留原路径与声明。

不提交整套与本项目无关的 Swift、Expo 等 skills。升级时先阅读上游差异，校验与 Vue、项目设计 token 及开发规范的兼容性，再统一更新仓库副本、固定提交和许可证记录。日常开发与换电脑安装沿用固定版本，不自动更新到上游最新版。
