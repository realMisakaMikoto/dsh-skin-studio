# DSH 皮肤工作室 · 桌面版

[English](README.md) · [下载桌面版](https://github.com/realMisakaMikoto/dsh-skin-studio/releases) · [反馈问题](https://github.com/realMisakaMikoto/dsh-skin-studio/issues)

在 **DeepSeek Harness Windows 桌面版**中创建、预览和分享完整皮肤。本仓库现维护桌面版，接续原来已停止维护的 WebUI 专用 `0.6.0-alpha.1`。

已验证 **DSH 桌面版 0.2.0-rc.2**。其他桌面版本和操作系统尚未验证。旧 WebUI 用户可从[历史版本](https://github.com/realMisakaMikoto/dsh-skin-studio/releases/tag/0.6.0-alpha.1)下载原版。

## 安装

1. 至少启动过一次 DSH 桌面版，让它建立配置目录。保存当前工作，然后完全退出 DSH。
2. 在终端运行 `node --version`；若提示找不到命令，请先安装 Node.js 22 或更新版本。
3. 在 Release 页面下载桌面版的 **Source code (zip)** 或 `.tgz` 安装包，解压到一个固定文件夹。
4. 双击解压目录内的 **`install-desktop.cmd`**。也可在该目录运行 `node scripts/install-desktop.mjs`。
5. 重新打开 DSH，从 **左下角账号菜单 → 设置 → 通用设置 → 自定义皮肤 → 打开皮肤工作室**进入。

Release 的源码压缩包已经包含构建好的客户端和主题素材，安装时不需要自行构建。安装后请保留解压目录：桌面配置使用本地链接引用它。

安装脚本会备份当前 profile，使用 DSH 自带的 pnpm 安装并启用本插件，保留其他插件设置。备份位置会打印在安装窗口中。全局命令 `dsh plugin --profile desktop add` 可能因桌面配置由 Electron 管理而被拒绝，请使用随包提供的安装脚本。

若 DSH 或 profile 不在默认位置，可先预览安装动作，再执行：

```sh
node scripts/install-desktop.mjs --profile "D:/DSH/profile" --resources "D:/DSH/resources" --dry-run
node scripts/install-desktop.mjs --profile "D:/DSH/profile" --resources "D:/DSH/resources"
```

桌面版也通过 npm 的原包名 [`dsh-skin-studio@0.7.0`](https://www.npmjs.com/package/dsh-skin-studio/v/0.7.0) 分发，可运行：

```sh
npm pack dsh-skin-studio@0.7.0
tar -xzf dsh-skin-studio-0.7.0.tgz
node package/scripts/install-desktop.mjs
```

执行安装脚本前请保存工作并完全退出 DSH，安装后保留解压得到的 `package` 文件夹。已有桌面版无需重复安装，GitHub 与 npm 包包含相同编辑器；切换分发渠道时先停用旧的本地皮肤工作室入口，避免同时启用两份。`0.6.0-alpha.1` 及更早版本仍属于历史 WebUI 版本。

## 六个完整编辑页面

| 页面 | 功能 |
| --- | --- |
| 皮肤库 | 新建、复制、编辑、启用、删除、恢复 DSH 默认 |
| 基础编辑 | 浅深配色、OKLCH 生成、背景图片/视频、WOFF2 字体 |
| 界面组件 | 分组 Token、搜索、组件点选、独立媒体、透明度、遮罩与模糊 |
| 素材替换 | 五个视觉位置、原始/自定义预览、侧栏品牌布局 |
| 文案 | 固定双语文案、自由文字与输入提示替换 |
| 导入导出 | 完整 `.dshskin` v5 文件、资源校验、同 ID 保留/替换/取消 |

内置 **17 套完整主题**：Bright Studio、High Contrast、Tidal Paper，13 套虹ヶ咲角色主题，以及 1 套全团主题。素材已随插件提供；更新时保留用户编辑过的预设。

编辑会实时预览，“应用并保存”持久化并启用，“取消预览”恢复之前的皮肤。有未保存修改时关闭会提示确认。低对比度和组件背景可读性问题会明确显示；保存过程中保护正在提交的草稿。

组件和文字点选时，工作室暂时收起；用 F2 切换“选择目标”和“操作界面”，用 Esc 返回。不会改写用户输入或聊天内容。欢迎页、已有会话和折叠侧栏展示的元素不同，素材位置暂时不存在时会显示兼容状态并保留默认内容。

图片支持 PNG/JPEG/WebP，视频支持 MP4/WebM，字体支持 WOFF2。视频静音循环，系统减少动态效果时暂停。

## 数据和旧版迁移

皮肤与完整资源保存在独立的 `dsh-desktop-skin-studio` IndexedDB 数据库，启用快照保存在 localStorage，重启恢复同一套皮肤。原 WebUI 插件的数据库不受影响；两版之间可通过 `.dshskin` 文件转移皮肤。

早期桌面版 v1 数据会事务性升级到 v2，原始清单、资源和快照保存在 `migration-backups`。无法转换的记录保留并显示提示。取消预览、切换、恢复默认和卸载都会清理背景、字体、文字覆盖、观察器与 Blob URL。

## 开发与检查

```sh
npm ci
npm run verify
npm run verify:client
npm pack
```

修改 `src/` 下的 TypeScript/TSX/CSS，再执行 `npm run build`；`client.js` 是生成文件。客户端使用宿主提供的 React，界面通过 `settings.general.item` 和 `shell.overlay` 槽位渲染。安装或构建更新后完整重启 DSH 验证。

CI 在 Windows/Linux、Node.js 22/24 上检查源码，桌面运行环境目前仅验证 Windows。已安装宿主的可选检查包括 `npm run check:install`、`npm run asar` 和 `npm run drift`。非标准路径可设置 `DSKIN_RESOURCES_DIR`、`DSKIN_DSH_ROOT`、`DSH_HOME` 或 `DSH_PROFILE_DIR`。

详见[运行接口](docs/runtime-facts.md)、[验收历史](docs/verification.md)和[皮肤包格式](docs/skin-format-v5.md)。反馈问题时请附 DSH 版本、插件版本和复现步骤。

## 许可与来源

源码延续原项目的 **AGPL-3.0-only** 许可；旧桌面接入代码的 MIT 声明保留于 `LICENSE.local-MIT`。角色素材不属于源码许可，归属见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。
