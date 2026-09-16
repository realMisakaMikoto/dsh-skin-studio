# dsh-skin-studio

[![npm](https://img.shields.io/npm/v/dsh-skin-studio)](https://www.npmjs.com/package/dsh-skin-studio)
[![CI](https://github.com/realMisakaMikoto/dsh-skin-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/realMisakaMikoto/dsh-skin-studio/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

DeepSeek Harness Web UI 的皮肤编辑器，作为 DSH Web profile 的浏览器 Client 插件运行。一套皮肤包含浅色/深色配色、主背景、组件媒体、品牌图标、双语界面文案、自由文本替换规则和字体，通过 `.dshskin` v5 文件导入导出。

## 安装

需要 Node.js 20+ 和 DeepSeek Harness Web profile。

```sh
dsh plugin --profile web add dsh-skin-studio
dsh web
```

插件保持向下兼容，装最新版即可。要锁版本：

```sh
dsh plugin --profile web add dsh-skin-studio@0.6.0-alpha.1 --save-exact
dsh web
```

装完在 **设置 → 通用设置 → 自定义皮肤 → 打开皮肤工作室** 进入。

## 工作室页面

| 页面 | 内容 |
| --- | --- |
| 皮肤库 | 新建、复制、编辑、启用、删除、恢复 DSH 默认，以及单套皮肤包的操作 |
| 基础编辑 | 名称、作者、简介、浅色/深色六组语义色、主背景、界面字体与代码字体 |
| 界面组件 | 常用 DSH Token、Token 搜索、组件点选、组件图片/视频、透明度、遮罩与模糊 |
| 素材替换 | 空状态标志、Hero 背景插图、侧边栏品牌图标、完整 Logo、工作区文件夹图标 |
| 文案 | 中英文固定文案、自由文本选择器、普通文字与 placeholder |
| 导入导出 | `.dshskin` 导入导出；同 ID 时可选保留两份、替换现有皮肤或取消 |

## 能改什么

配色保留 DSH 的浅色、深色、跟随系统三种模式。六组基础语义色是强调色、页面背景、表面、正文、侧栏、代码背景；填一组之后用 OKLCH 生成另一模式，生成结果仍可单独微调。应用前有文字与强调色的对比度检查。

主背景支持 PNG、JPEG、WebP、MP4、WebM。浅色和深色各自保存背景透明度、界面遮盖强度和明暗遮罩，背景与组件媒体都能加模糊，视频自动静音循环。组件点选器把同一结构类型的组件归成一组，最多保存 64 条组件媒体规则；运行时最多维护 200 个组件媒体层和 12 个视频层。

组件点选器和文本点选器都有两种模式：**选择目标**模式用鼠标点选，或用方向键、Tab、Enter、空格浏览确认；**操作界面**模式可以正常点击、输入、展开菜单，按 `F2` 切回选择。`Esc` 回到工作室。

五个视觉素材位置：

| Slot | 位置 | 建议尺寸 |
| --- | --- | --- |
| `hero-whale-logo` | 新会话标题左侧标志 | 272 × 200 |
| `hero-backdrop-illustration` | 新会话输入区后的 Hero 插图 | 2102 × 936 |
| `sidebar-brand-mark` | 侧边栏品牌图标 | 96 × 71 |
| `sidebar-brand-wordmark` | 侧边栏品牌字样或完整 Logo | 624 × 96 |
| `workspace-folder-icon` | 侧边栏与欢迎页工作区图标 | 64 × 64 |

侧边栏品牌支持「图标 + 字样」和「单图品牌」两种布局。单图品牌展开时用完整 Logo，收起时用品牌图标。

文案部分覆盖欢迎标题、欢迎标记、欢迎输入提示、工作区提示和侧边栏新会话五个固定位置，每个位置分别存中英文。自由文本规则记录显示名称、文字样本、结构化目标和双语替换值，最多 128 条，单条结构路径最多 6 层，单语言替换值最多 300 字。替换只改直接的 Text 节点和 placeholder，组件内图标与子控件保持原结构；可见文字与原 aria-label 一致时同步更新无障碍名称。界面字体和代码字体都支持 WOFF2。

## 内置皮肤

首次启动会往当前浏览器写入 17 套皮肤：3 套基础预设（Bright Studio、High Contrast、Tidal Paper），13 套角色主题，以及 1 套虹ヶ咲学園スクールアイドル同好会全团主题。

13 位角色：上原歩夢、高咲侑、中須かすみ、桜坂しずく、朝香果林、宮下愛、近江彼方、優木せつ菜、エマ・ヴェルデ、天王寺璃奈、三船栞子、ミア・テイラー、鐘嵐珠。截图都在 [`docs/screenshots/skins/`](docs/screenshots/skins)。

| 上原歩夢 | 高咲侑 |
| --- | --- |
| ![上原歩夢](docs/screenshots/skins/ayumu.webp) | ![高咲侑](docs/screenshots/skins/yu.webp) |
| **桜坂しずく** | **優木せつ菜** |
| ![桜坂しずく](docs/screenshots/skins/shizuku.webp) | ![優木せつ菜](docs/screenshots/skins/setsuna.webp) |

内置主题包含背景、浅色/深色配色、角色素材、双语文案和八类组件背景。插件升级会刷新没被编辑过的内置版本，用户改过的版本保留。

## `.dshskin` v5

`.dshskin` 是带版本号的 ZIP 容器，根目录放 `manifest.json` 和它引用的本地资源。格式里保存皮肤身份、浅色/深色配色、DSH Token 覆盖、主背景与组件媒体、视觉素材、字体描述符、五个 Visual Slot、固定双语文案、自由文本规则，以及每个资源的 MIME、字节大小、路径和 SHA-256。v1–v4 在导入时迁移到 v5，schema 与迁移说明见 [`docs/skin-format-v5.md`](docs/skin-format-v5.md)。

资源上限：

| 项目 | 上限 |
| --- | ---: |
| 单个 `.dshskin` 包 | 128 MB |
| 背景或组件图片 | 15 MB |
| 背景或组件视频 | 100 MB |
| 单个视觉替换素材 | 5 MB |
| 单个 WOFF2 字体 | 5 MB |

导入时校验 manifest、资源路径、文件签名、声明大小和 SHA-256。

## 数据存放

完整皮肤和 Blob 资源存在当前 origin 的 IndexedDB，启用中的皮肤在 localStorage 存一份轻量快照供页面启动时恢复，同源标签页通过 BroadcastChannel 同步皮肤库状态。启用、切换、取消预览或卸载插件时会清理背景、组件层、字体、文字覆盖和 Blob URL。React 重建节点后，MutationObserver 会重新应用组件媒体、视觉素材和文字规则。

## 环境要求

当前版本基线：DeepSeek Harness `0.1.0-rc.8` 及以后（含 `0.1.2-alpha.3`、`0.1.6-alpha.1` 等）、Node.js 20+、React 18、桌面版 Chrome / Edge。

插件随 DSH 一起向后兼容，安装时直接装最新版即可，不需要按 DSH 版本挑选插件版本。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm package:check
```

`pnpm check` 依次跑类型检查、Vitest、Client/Host 构建和 npm 包内容校验；`pnpm pack` 出包。

## 许可

源代码用 [GNU Affero General Public License v3.0](LICENSE)。内置主题用到的角色、标志和媒体归属见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。
