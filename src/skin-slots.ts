export const SKIN_LOCALES = ['zh', 'en'] as const
export type SkinLocale = (typeof SKIN_LOCALES)[number]

export const VISUAL_ASSET_SLOT_IDS = [
  'hero-whale-logo',
  'hero-backdrop-illustration',
  'sidebar-brand-wordmark',
  'workspace-folder-icon',
] as const
export type VisualAssetSlotId = (typeof VISUAL_ASSET_SLOT_IDS)[number]

export const COPY_SLOT_IDS = [
  'welcome.title',
  'welcome.badge',
  'composer.welcome-placeholder',
  'workspace.choose',
  'sidebar.new-session',
  'settings.title',
] as const
export type CopySlotId = (typeof COPY_SLOT_IDS)[number]

export interface VisualAssetSlotDefinition {
  id: VisualAssetSlotId
  name: Record<SkinLocale, string>
  description: Record<SkinLocale, string>
  originalElement: string
  acceptedMimeTypes: readonly ['image/png', 'image/jpeg', 'image/webp']
  recommendedSize: string
  aspectRatio: string
  compatibility: string
  fallback: Record<SkinLocale, string>
}

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const VISUAL_ASSET_SLOTS: readonly VisualAssetSlotDefinition[] = [
  {
    id: 'hero-whale-logo',
    name: { zh: '空状态鲸鱼标志', en: 'Empty-state whale mark' },
    description: { zh: '替换新会话欢迎标题左侧的 DSH 鲸鱼标志。', en: 'Replaces the DSH whale mark beside the new-session welcome title.' },
    originalElement: 'Conversation Hero FishLogo inline SVG (viewBox 23.16 x 17.04)',
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    recommendedSize: '272 x 200 px',
    aspectRatio: '23.16:17.04',
    compatibility: 'DSH rc.6 and current HeroShell FishLogo geometry',
    fallback: { zh: '定位失败时保留 DSH 原标志。', en: 'Keeps the DSH mark when the slot cannot be located.' },
  },
  {
    id: 'hero-backdrop-illustration',
    name: { zh: '空状态背景插图', en: 'Empty-state backdrop illustration' },
    description: { zh: '替换新会话输入区域后的柔光背景，可用于完整角色插图。', en: 'Replaces the soft hero backdrop behind the new-session composer.' },
    originalElement: 'Conversation HeroGlow inline SVG (viewBox 1051 x 468)',
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    recommendedSize: '2102 x 936 px',
    aspectRatio: '1051:468',
    compatibility: 'DSH rc.6 and current HeroGlow viewBox',
    fallback: { zh: '定位失败时保留 DSH 原柔光背景。', en: 'Keeps the DSH glow when the slot cannot be located.' },
  },
  {
    id: 'sidebar-brand-wordmark',
    name: { zh: '侧边栏品牌标志', en: 'Sidebar brand wordmark' },
    description: { zh: '替换侧边栏顶部的 DeepSeek Harness 品牌图形。', en: 'Replaces the DeepSeek Harness wordmark at the top of the sidebar.' },
    originalElement: 'Sidebar BrandWordmark inline SVG (viewBox 182 x 24)',
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    recommendedSize: '728 x 96 px',
    aspectRatio: '182:24',
    compatibility: 'DSH rc.6 and current BrandWordmark geometry',
    fallback: { zh: '定位失败时保留 DSH 原品牌标志。', en: 'Keeps the DSH wordmark when the slot cannot be located.' },
  },
  {
    id: 'workspace-folder-icon',
    name: { zh: '工作区文件夹图标', en: 'Workspace folder icon' },
    description: { zh: '替换侧边栏工作区和欢迎页工作区选择器中的文件夹图标。', en: 'Replaces folder glyphs in workspace rows and the welcome workspace picker.' },
    originalElement: 'Workspace IconFolderOpen16 / IconFolderClose16 inline SVG',
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    recommendedSize: '64 x 64 px',
    aspectRatio: '1:1',
    compatibility: 'DSH rc.6 and current 16px workspace folder geometry',
    fallback: { zh: '定位失败的文件夹继续显示 DSH 原图标。', en: 'Any folder target that cannot be located keeps its DSH icon.' },
  },
]

export interface CopySlotDefinition {
  id: CopySlotId
  name: Record<SkinLocale, string>
  description: Record<SkinLocale, string>
  original: Record<SkinLocale, string>
  maxLength: number
  compatibility: string
}

export const COPY_SLOTS: readonly CopySlotDefinition[] = [
  { id: 'welcome.title', name: { zh: '欢迎标题', en: 'Welcome title' }, description: { zh: '新会话中央的主标题。', en: 'The main title in a new conversation.' }, original: { zh: '探索未至之境', en: 'Into the Unknown' }, maxLength: 80, compatibility: 'conversation hero headline' },
  { id: 'welcome.badge', name: { zh: '欢迎页标记', en: 'Welcome badge' }, description: { zh: '欢迎标题右上方的版本标记。', en: 'The small badge beside the welcome title.' }, original: { zh: '预览版', en: 'Preview' }, maxLength: 40, compatibility: 'conversation hero preview badge' },
  { id: 'composer.welcome-placeholder', name: { zh: '欢迎输入提示', en: 'Welcome composer placeholder' }, description: { zh: '空白新会话输入框中的提示文字。', en: 'Placeholder text in the blank-session composer.' }, original: { zh: '描述你想要构建的内容', en: 'Describe what you want to build' }, maxLength: 120, compatibility: 'hero composer textarea placeholder' },
  { id: 'workspace.choose', name: { zh: '工作区选择提示', en: 'Workspace chooser prompt' }, description: { zh: '尚未选择工作区时显示的提示。', en: 'Prompt shown before a workspace is selected.' }, original: { zh: '选择工作区', en: 'Choose workspace' }, maxLength: 80, compatibility: 'hero workspace menu button' },
  { id: 'sidebar.new-session', name: { zh: '侧边栏新会话', en: 'Sidebar new-session label' }, description: { zh: '侧边栏新建会话按钮的可见文字和无障碍名称。', en: 'Visible and accessible label of the sidebar new-session button.' }, original: { zh: '新会话', en: 'New Session' }, maxLength: 60, compatibility: 'sidebar new-session button' },
  { id: 'settings.title', name: { zh: '设置标题', en: 'Settings title' }, description: { zh: 'DSH 设置窗口的标题。', en: 'Title of the DSH settings dialog.' }, original: { zh: '设置', en: 'Settings' }, maxLength: 60, compatibility: 'settings dialog labelled heading' },
]

export const VISUAL_ASSET_SLOT_SET: ReadonlySet<string> = new Set(VISUAL_ASSET_SLOT_IDS)
export const COPY_SLOT_SET: ReadonlySet<string> = new Set(COPY_SLOT_IDS)

export function copySlotDefinition(id: CopySlotId): CopySlotDefinition {
  return COPY_SLOTS.find(slot => slot.id === id)!
}
