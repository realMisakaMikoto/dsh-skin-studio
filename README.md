<h1 align="center">dsh-skin-studio</h1>

<p align="center">
  DeepSeek Harness Web UI 的本地皮肤工作室：创建、实时预览、管理与分享完整外观。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-skin-studio"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-skin-studio?color=cb4b8c"></a>
  <a href="https://github.com/realMisakaMikoto/dsh-skin-studio/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/realMisakaMikoto/dsh-skin-studio/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/realMisakaMikoto/dsh-skin-studio/blob/main/LICENSE"><img alt="AGPL-3.0 license" src="https://img.shields.io/badge/license-AGPL--3.0-2f855a.svg"></a>
  <img alt="DeepSeek Harness rc.8" src="https://img.shields.io/badge/DeepSeek%20Harness-0.1.0--rc.8-2563eb">
</p>

`dsh-skin-studio` 运行在 DSH Web profile 的浏览器 Client 中。一套皮肤可以同时携带浅色/深色配色、主背景、组件媒体、品牌与图标、双语文案、自由文本规则和字体，并通过 `.dshskin` v5 完整导入导出。

## 快速开始

要求 Node.js 20+ 与 DeepSeek Harness Web profile。

```sh
dsh plugin --profile web add dsh-skin-studio@0.5.0 --save-exact
dsh web
```

启动后进入：

**设置 → 通用设置 → 自定义皮肤 → 打开皮肤工作室**

## 工作室结构

| 页面 | 源码当前提供的能力 |
| --- | --- |
| **皮肤库** | 新建、复制、编辑、启用、删除、恢复 DSH 默认，以及进入单套皮肤包操作 |
| **基础编辑** | 名称、作者、简介、浅色/深色六组语义色、主背景、界面字体与代码字体 |
| **界面组件** | 常用 DSH Token、完整 Token 搜索、组件点选、组件图片/视频、透明度、遮罩与模糊 |
| **素材替换** | 空状态标志、Hero 背景插图、侧边栏品牌图标、完整 Logo、工作区文件夹图标 |
| **文案** | 中文/英文固定文案、自由文本选择器、普通文字和 placeholder |
| **导入导出** | `.dshskin` 导入、导出，以及同 ID 时保留两份、替换现有皮肤或取消 |

## 皮肤能力

### 配色与外观

- 保留 DSH 的浅色、深色与跟随系统模式。
- 六组基础语义色：强调色、页面背景、表面、正文、侧栏、代码背景。
- 使用 OKLCH 生成另一模式，生成后仍可分别微调。
- 常用组件视图与完整 DSH Theme Token 视图。
- 应用前提供文字与强调色对比度检查。

### 背景与组件媒体

- 主背景支持 PNG、JPEG、WebP、MP4、WebM。
- 每种模式分别保存背景透明度、界面遮盖强度与明暗遮罩。
- 背景和组件媒体均支持模糊；视频自动静音循环。
- 组件点选器会把同一结构类型的组件统一成组。
- 最多保存 64 条组件媒体规则；运行时最多维护 200 个组件媒体层和 12 个视频层。
- 组件媒体提供单独的可读性确认。

### 点选器与键盘操作

组件与文本点选器都提供两种模式：

- **选择目标**：鼠标点选，或使用方向键、Tab、Enter、空格浏览与确认。
- **操作界面**：正常点击、输入、展开菜单和临时界面，再按 `F2` 返回选择。
- `Esc` 返回工作室，`F2` 在两种模式之间切换。

### 五个视觉素材位置

| Slot | 用途 | 推荐尺寸 |
| --- | --- | --- |
| `hero-whale-logo` | 新会话标题左侧标志 | 272 × 200 |
| `hero-backdrop-illustration` | 新会话输入区后的 Hero 插图 | 2102 × 936 |
| `sidebar-brand-mark` | 侧边栏品牌图标 | 96 × 71 |
| `sidebar-brand-wordmark` | 侧边栏品牌字样或完整 Logo | 624 × 96 |
| `workspace-folder-icon` | 侧边栏与欢迎页工作区图标 | 64 × 64 |

侧边栏品牌支持“图标 + 字样”和“单图品牌”两种布局。单图品牌在展开状态使用完整 Logo，收起状态保留品牌图标。

### 文案与字体

- 固定文案覆盖欢迎标题、欢迎标记、欢迎输入提示、工作区提示和侧边栏新会话。
- 每个固定位置分别保存中文与英文。
- 自由文本规则记录显示名称、文字样本、结构化目标与双语替换值。
- 最多保存 128 条自由文本规则；单条结构路径最多 6 层，单语言替换值最多 300 字。
- 仅更新直接 Text 节点或 placeholder，组件内图标与子控件保持原结构。
- 当可见文字与原 aria-label 一致时，同步维护无障碍名称。
- 界面字体与代码字体均支持 WOFF2。

## 17 套内置皮肤

首次启动会向当前浏览器写入：

- 3 套基础预设：`Bright Studio`、`High Contrast`、`Tidal Paper`。
- 13 位角色主题：上原歩夢、高咲侑、中須かすみ、桜坂しずく、朝香果林、宮下愛、近江彼方、優木せつ菜、エマ・ヴェルデ、天王寺璃奈、三船栞子、ミア・テイラー、鐘嵐珠。
- 1 套 **虹ヶ咲学園スクールアイドル同好会** 全团主题。

内置主题包含背景、浅色/深色配色、角色化视觉素材、双语文案与八类组件背景。插件升级会刷新保持原始状态的内置版本，并保留用户编辑后的版本。

## 13 位角色主题预览

以下图片均来自当前 `0.5.0` 源码构建的 DSH 新会话页，使用浅色模式和 `1707 × 782` 完整视口。

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>上原歩夢</strong><br>
      <sub>樱花粉与夕阳暖金交织的温柔海滨舞台。</sub><br><br>
      <img src="docs/screenshots/skins/ayumu.webp" alt="上原歩夢皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>高咲侑</strong><br>
      <sub>黑与薄荷绿交织的创作舞台，为每一次心动写下旋律。</sub><br><br>
      <img src="docs/screenshots/skins/yu.webp" alt="高咲侑皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>中須かすみ</strong><br>
      <sub>奶油黄与莓果色的可爱作战室。</sub><br><br>
      <img src="docs/screenshots/skins/kasumi.webp" alt="中須かすみ皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>桜坂しずく</strong><br>
      <sub>深蓝幕布与脚灯构成的安静剧场。</sub><br><br>
      <img src="docs/screenshots/skins/shizuku.webp" alt="桜坂しずく皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>朝香果林</strong><br>
      <sub>靛蓝夜色中的精致时装工作室。</sub><br><br>
      <img src="docs/screenshots/skins/karin.webp" alt="朝香果林皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>宮下愛</strong><br>
      <sub>被橙色夕阳点亮的快乐海滨。</sub><br><br>
      <img src="docs/screenshots/skins/ai.webp" alt="宮下愛皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>近江彼方</strong><br>
      <sub>薰衣草月夜里的柔软休息室。</sub><br><br>
      <img src="docs/screenshots/skins/kanata.webp" alt="近江彼方皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>優木せつ菜</strong><br>
      <sub>把热爱点燃到最后一刻的赤红舞台。</sub><br><br>
      <img src="docs/screenshots/skins/setsuna.webp" alt="優木せつ菜皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>エマ・ヴェルデ</strong><br>
      <sub>连接山野与台场的清新绿色庭院。</sub><br><br>
      <img src="docs/screenshots/skins/emma.webp" alt="エマ・ヴェルデ皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>天王寺璃奈</strong><br>
      <sub>青蓝与粉色信号构成的数字实验室。</sub><br><br>
      <img src="docs/screenshots/skins/rina.webp" alt="天王寺璃奈皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>三船栞子</strong><br>
      <sub>象牙白与翡翠色的学生会档案室。</sub><br><br>
      <img src="docs/screenshots/skins/shioriko.webp" alt="三船栞子皮肤全屏截图">
    </td>
    <td width="50%" valign="top">
      <strong>ミア・テイラー</strong><br>
      <sub>银色、冰青与深蓝交织的专业录音棚。</sub><br><br>
      <img src="docs/screenshots/skins/mia.webp" alt="ミア・テイラー皮肤全屏截图">
    </td>
  </tr>
  <tr>
    <td colspan="2" valign="top">
      <strong>鐘嵐珠</strong><br>
      <sub>洋红、深红与香槟金构成的顶层舞台。</sub><br><br>
      <p align="center"><img src="docs/screenshots/skins/lanzhu.webp" alt="鐘嵐珠皮肤全屏截图" width="70%"></p>
    </td>
  </tr>
</table>

## `.dshskin` v5

`.dshskin` 是带版本的 ZIP 容器，根目录包含 `manifest.json` 与 manifest 引用的本地资源。当前格式保存：

- 皮肤身份、浅色/深色配色和 DSH Token 覆盖。
- 主背景、组件媒体、视觉素材、界面字体与代码字体描述符。
- 五个语义 Visual Slot、固定双语文案和自由文本规则。
- 资源 MIME、字节大小、路径和 SHA-256。
- `sidebarBrandLayout` 与结构化组件/文本目标。

v1–v4 皮肤会在导入时迁移到 v5。完整 schema 与迁移说明见 [docs/skin-format-v5.md](docs/skin-format-v5.md)。

### 资源上限

| 项目 | 上限 |
| --- | ---: |
| 单个 `.dshskin` 包 | 128 MB |
| 背景或组件图片 | 15 MB |
| 背景或组件视频 | 100 MB |
| 单个视觉替换素材 | 5 MB |
| 单个 WOFF2 字体 | 5 MB |

导入时会校验 manifest、资源路径、文件签名、声明大小和 SHA-256。

## 数据与运行时

- 完整皮肤与 Blob 资源保存在当前 origin 的 IndexedDB。
- 当前启用皮肤的轻量快照保存在 localStorage，用于页面启动阶段恢复。
- 同源标签页通过 BroadcastChannel 刷新皮肤库状态。
- 启用、切换、取消预览和释放插件时会清理背景、组件层、字体、文字覆盖与 Blob URL。
- React 重建节点后，MutationObserver 会重新应用组件媒体、视觉素材和文字规则。
- 内置皮肤按稳定 ID 写入；升级时更新未编辑版本。

## 兼容性

| 项目 | 当前基线 |
| --- | --- |
| DeepSeek Harness | `0.1.0-rc.8` |
| Node.js | 20+ |
| React | 18 |
| 浏览器 | Chrome、Edge 等现代桌面浏览器 |
| DSH 结构 | rc.6 / rc.8 侧边栏品牌与 Hero 结构 |

## 开发与验证

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm package:check
```

完整验证：

```sh
pnpm check
pnpm pack
```

`pnpm check` 会依次执行类型检查、Vitest、Client/Host 构建和 npm 包内容校验。

## 相关链接

- [npm package](https://www.npmjs.com/package/dsh-skin-studio)
- [v0.5.0 Release](https://github.com/realMisakaMikoto/dsh-skin-studio/releases/tag/0.5.0)
- [`.dshskin` v5 格式](docs/skin-format-v5.md)
- [第三方素材说明](THIRD_PARTY_ASSETS.md)

## 许可证与第三方素材

- 项目源代码采用 [GNU Affero General Public License v3.0](LICENSE)。
- 内置主题使用的角色、标志与媒体归属说明见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。
