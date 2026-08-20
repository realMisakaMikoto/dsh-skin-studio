# .dshskin v5 格式

`.dshskin` 是 ZIP 容器，根目录只允许 `manifest.json` 和 manifest 明确列出的 `assets/*` 文件。v5 保留 v4 的配色、Token、背景、组件媒体、字体、视觉素材和固定 Copy Slot，并新增受控的自由文本规则。

## textOverrides

~~~json
{
  "format": "dsh-skin-studio",
  "formatVersion": 5,
  "textOverrides": [
    {
      "id": "text-save-action",
      "name": "保存按钮",
      "sample": "Save",
      "target": {
        "anchor": {
          "tagName": "button",
          "role": null,
          "classNames": ["actionButton"]
        },
        "path": [
          {
            "childIndex": 1,
            "tagName": "span",
            "role": null,
            "classNames": ["label"]
          }
        ],
        "property": "text",
        "textNodeIndex": 0
      },
      "replacements": {
        "zh": "保存",
        "en": "Save now"
      }
    }
  ]
}
~~~

`target` 只能包含点选器生成的结构化信息：受控组件锚点、最多 6 层的相对子元素路径、每层 `0–255` 的整数子索引、合法标签、可选角色和最多 4 个安全类名。`property` 只允许 `text` 或 `placeholder`；`text` 必须提供指向直接 Text 节点的 `textNodeIndex`，`placeholder` 必须省略它。manifest 不保存 CSS selector、XPath、HTML、JavaScript 或用户输入值。

每套皮肤最多 128 条自由文本规则。ID 必须是安全 ID；显示名称最多 80 字；样本和每种语言的替换值最多 300 字。名称和样本不能为空；替换可只提供 `zh` 或 `en`，缺少当前语言时保留 DSH 默认文字。控制字符、重复 ID、重复结构目标、非法路径和未知属性值会导致 manifest 被拒绝。

## 点选与运行时边界

- 可点选普通可见文字和 `input`/`textarea` 的 placeholder；不修改输入值、contenteditable 内容或仅供读屏的 aria-label。
- 组件与文本点选器都提供“选择目标”和“操作界面”模式；操作模式允许先正常点击、输入或展开临时界面，再通过顶部模式按钮或 `F2` 切回选择模式。切回时会重新扫描候选项。
- 设置界面与设置入口、`data-chat-flow-kind` 覆盖的全部聊天记录、项目 treeitem、会话/搜索 treeitem 和会话标题层级导航不可选择。
- 固定 Copy Slot 被点中时继续编辑对应固定项，不创建自由文本规则。`settings.title` 仍会被 v5 解码、保存和导出，但不再显示或应用。
- 运行时会再次检查排除边界，因此导入包不能绕过点选器限制。
- 一条规则会应用到全部相同结构目标。只写入直接 Text 节点或 placeholder，不使用 `element.textContent` 覆盖组件，因此不会删除 SVG、图标或子控件。
- 仅当原 `aria-label` 与原可见文字完全一致时才同步修改无障碍名称。React 重渲染、节点替换或原文变化后会重新定位；规则删除、取消预览、切换/停用皮肤及卸载时恢复最新原文字、placeholder 和同步过的 aria-label。

## v4 延续字段

`sidebarBrandLayout`、`visualAssetOverrides`、`copyOverrides`、`appearance`、`palettes`、`overrides` 和 `assets` 的约束延续 v4。固定 Copy Slot 包括 `welcome.title`、`welcome.badge`、`composer.welcome-placeholder`、`workspace.choose`、`sidebar.new-session`；历史 `settings.title` 仅保留数据。

视觉资源仍只接受 PNG、JPEG、WebP；包内资源继续校验路径、声明大小、magic bytes、MIME、SHA-256 和引用完整性。包展开后总量不超过 128 MB，不允许额外文件或路径穿越。

## 迁移

- v1–v3 先按既有规则补齐表面透明度、组件媒体、视觉素材和固定文案字段，再新增空 `textOverrides`。
- v4 保留全部字段与历史 `settings.title`，缺少 `sidebarBrandLayout` 时补为 `split`，并新增空 `textOverrides`。
- 高于 v5 的未知版本拒绝导入。
