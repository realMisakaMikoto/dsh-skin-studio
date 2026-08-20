# .dshskin v4 格式

.dshskin 是一个 ZIP 容器，根目录只允许 manifest.json 和 manifest 明确列出的 assets/* 文件。v4 在 v3 的配色、Token、背景、组件媒体和字体之上，新增语义化视觉素材与文案替换。

## 新字段

~~~json
{
  "format": "dsh-skin-studio",
  "formatVersion": 4,
  "sidebarBrandLayout": "split",
  "visualAssetOverrides": {
    "hero-whale-logo": "asset-hero"
  },
  "copyOverrides": {
    "welcome.title": {
      "zh": "今天也一起写代码吧",
      "en": "Let us build today"
    }
  }
}
~~~

visualAssetOverrides 的 key 必须来自插件公开的 Visual Asset Slot 目录，value 必须引用 kind 为 visual-asset 的资源。manifest 不保存 DOM selector、className、locale key 或节点层级。

sidebarBrandLayout 只允许 `split` 或 `single`。`split` 分别显示左侧品牌图标和右侧品牌字样；`single` 在展开侧边栏时隐藏左侧图标，让右侧自定义图片按 188px 原品牌宽度显示，并将顶部品牌行增高到 72px，收起侧边栏后仍显示左侧图标。缺少该字段的旧 v4 皮肤按 `split` 处理。

copyOverrides 的 key 必须来自 Copy Slot 目录。每项只允许 zh、en 两个纯文本字段，至少提供一种语言；空字符串、控制字符和超过该 slot 长度限制的内容会被拒绝。文本永远通过 textContent 或受控属性写入，不解释为 HTML。

## v4 Visual Asset Slot

| Slot | DSH 原元素 | 推荐尺寸 | 回退 |
| --- | --- | --- | --- |
| hero-whale-logo | 新会话 Hero 的 FishLogo | 272 × 200，23.16:17.04 | 保留 DSH 原鲸鱼 |
| hero-backdrop-illustration | 新会话 HeroGlow | 2102 × 936，1051:468 | 保留原柔光背景 |
| sidebar-brand-mark | 侧边栏左侧品牌图标 | 96 × 71，23.16:17.04 | 保留原鲸鱼图标 |
| sidebar-brand-wordmark | 侧边栏右侧品牌字样 | 624 × 96，156:24 | 保留原品牌字样 |
| workspace-folder-icon | 工作区 FolderOpen/FolderClose | 64 × 64，1:1 | 未定位的图标保留原样 |

视觉替换只接受 PNG、JPEG、WebP，单个文件不超过 5 MB。不接受任意 SVG，从而避免脚本、外部引用和 foreignObject 的复杂攻击面。

运行时保持替换图的原始长宽比。除右侧 `sidebar-brand-wordmark` 外，选择能让最终图片至少覆盖 DSH 原素材宽高的较大缩放倍数：scale = max(DSH 宽度 ÷ 素材宽度, DSH 高度 ÷ 素材高度)。例如 DSH 原素材为 1000 × 1000 时，200 × 300 的素材最终为 1000 × 1500；600 × 500 的素材最终为 1200 × 1000。一个方向与 DSH 原素材对齐，另一个方向允许超过。`sidebar-brand-wordmark` 的 `split` 模式使用 scale = min(...) 在 156 × 32 光学安全区内完整显示；`single` 模式固定宽度为 188px，高度按素材比例计算，并使用 72px 顶部品牌行避免裁切。窗口尺寸变化时会重新计算。

## v4 Copy Slot

当前目录包括 welcome.title、welcome.badge、composer.welcome-placeholder、workspace.choose、sidebar.new-session 和 settings.title。插件按 DSH 当前语言读取对应 zh 或 en 值；缺少当前语言时保留官方文案。

## 迁移

- v1 → v4：补齐表面透明度、空组件媒体、空视觉素材和空文案覆盖。
- v2 → v4：补齐空组件媒体、空视觉素材和空文案覆盖。
- v3 → v4：保留全部已有资源和组件媒体，只新增空 visualAssetOverrides 与 copyOverrides。
- 高于 v4 的未知版本拒绝导入。

## 安全与完整性

- 所有资源继续校验 ZIP 路径、声明大小、magic bytes、MIME、SHA-256 和引用完整性。
- visual-asset 只接受真实图片签名；视频、字体、SVG 和伪造扩展名会被拒绝。
- 包展开后总量不超过 128 MB，且不允许额外文件或路径穿越。
- slot 无法在当前 DSH 版本定位时只跳过该项，不影响整套皮肤加载。
- 应用、取消、切换皮肤和卸载都会恢复原节点、原文案、样式并撤销 Blob URL。
