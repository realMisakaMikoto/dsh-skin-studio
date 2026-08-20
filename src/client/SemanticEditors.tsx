import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { MAX_TEXT_OVERRIDE_RULES, MAX_TEXT_OVERRIDE_VALUE_LENGTH, type SidebarBrandLayout, type SkinManifestV1 } from '../model.ts'
import {
  EDITABLE_COPY_SLOTS, SKIN_LOCALES, VISUAL_ASSET_SLOTS,
  type CopySlotId, type SkinLocale, type VisualAssetSlotId,
} from '../skin-slots.ts'
import { findCopySlotTargets, findVisualSlotTargets } from './semantic-slots.ts'
import { findTextOverrideTargets } from './text-targets.ts'
import type { SkinStudioKey } from './locales.ts'
import css from './studio.module.css'

type Translate = (key: SkinStudioKey) => string

function OriginalVisualPreview({ slotId, unavailable }: { slotId: VisualAssetSlotId; unavailable: string }) {
  const source = findVisualSlotTargets(slotId)[0]
  if (!(source instanceof SVGElement)) {
    return <div className={css.originalVisualPreview} data-empty>{unavailable}</div>
  }
  const clone = source.cloneNode(true) as SVGElement
  clone.removeAttribute('class')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('style', 'color:#52666c;--dsw-alias-label-primary-inverted:#ffffff')
  clone.setAttribute('width', '100%')
  clone.setAttribute('height', '100%')
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))
  return <div className={css.originalVisualPreview}><img src={url} alt="" /></div>
}

function CustomVisualPreview({ blob, empty }: { blob: Blob | undefined; empty: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (blob === undefined) { setUrl(undefined); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => { URL.revokeObjectURL(next) }
  }, [blob])
  return <div className={css.customVisualPreview} data-empty={url === undefined || undefined}>{url === undefined ? empty : <img src={url} alt="" />}</div>
}

export function VisualAssetEditor({ draft, assets, locale, error, t, onPick, onRemove, onBrandLayoutChange }: {
  draft: SkinManifestV1
  assets: ReadonlyMap<string, Blob>
  locale: SkinLocale
  error: 'invalid' | 'too-large' | null
  t: Translate
  onPick: (slotId: VisualAssetSlotId, file: File | undefined) => void
  onRemove: (slotId: VisualAssetSlotId) => void
  onBrandLayoutChange: (layout: SidebarBrandLayout) => void
}) {
  const inputs = useRef<Map<VisualAssetSlotId, HTMLInputElement>>(new Map())
  const hasWordmark = draft.visualAssetOverrides['sidebar-brand-wordmark'] !== undefined
  return (
    <section className={css.semanticEditor} aria-labelledby="skin-studio-visual-title">
      <div className={css.semanticEditorIntro}>
        <h3 id="skin-studio-visual-title">{t('visual.title')}</h3>
        <p>{t('visual.description')}</p>
      </div>
      <div className={css.brandLayoutControl}>
        <div><strong>{t('visual.brandLayout')}</strong><p>{t('visual.brandLayoutHint')}</p></div>
        <div role="group" aria-label={t('visual.brandLayout')} className={css.segmented}>
          {(['split', 'single'] as const).map(layout => <button
            key={layout}
            type="button"
            aria-pressed={draft.sidebarBrandLayout === layout}
            disabled={layout === 'single' && !hasWordmark}
            onClick={() => { onBrandLayoutChange(layout) }}
          >{t(layout === 'split' ? 'visual.brandLayoutSplit' : 'visual.brandLayoutSingle')}</button>)}
        </div>
      </div>
      {error !== null && <p className={css.error} role="alert">{t(error === 'too-large' ? 'visual.tooLarge' : 'visual.invalid')}</p>}
      <div className={css.semanticRows}>
        {VISUAL_ASSET_SLOTS.map(slot => {
          const available = findVisualSlotTargets(slot.id).length > 0
          const assetId = draft.visualAssetOverrides[slot.id]
          const descriptor = assetId === undefined ? undefined : draft.assets.find(asset => asset.id === assetId)
          return <article className={css.semanticRow} key={slot.id}>
            <div className={css.semanticRowHeading}>
              <div><strong>{slot.name[locale]}</strong><p>{slot.description[locale]}</p></div>
              <span className={css.compatibilityStatus} data-available={available || undefined}>{available ? t('slot.available') : t('slot.unavailable')}</span>
            </div>
            <div className={css.visualComparison}>
              <figure><figcaption>{t('visual.original')}</figcaption><OriginalVisualPreview slotId={slot.id} unavailable={t('slot.unavailableShort')} /></figure>
              <figure><figcaption>{t('visual.custom')}</figcaption><CustomVisualPreview blob={assetId === undefined ? undefined : assets.get(assetId)} empty={t('visual.notSet')} /></figure>
            </div>
            <div className={css.semanticDetails}>
              <span>{t('visual.recommended')}: {slot.recommendedSize} · {slot.aspectRatio}</span>
              {descriptor !== undefined && <span>{descriptor.mimeType.replace('image/', '').toUpperCase()} · {Math.ceil(descriptor.size / 1024)} KB</span>}
            </div>
            <input
              ref={node => { if (node === null) inputs.current.delete(slot.id); else inputs.current.set(slot.id, node) }}
              data-visual-slot-upload={slot.id}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              onChange={event => { onPick(slot.id, event.target.files?.[0]); event.target.value = '' }}
            />
            <div className={css.semanticActions}>
              <Button size="sm" variant={assetId === undefined ? 'primary' : 'outline'} onClick={() => { inputs.current.get(slot.id)?.click() }}>{assetId === undefined ? t('visual.upload') : t('visual.replace')}</Button>
              {assetId !== undefined && <Button size="sm" onClick={() => { onRemove(slot.id) }}>{t('visual.restore')}</Button>}
            </div>
          </article>
        })}
      </div>
    </section>
  )
}

export type CopyEditorFocus = { kind: 'fixed'; id: CopySlotId } | { kind: 'free'; id: string }

export function CopyOverrideEditor({ draft, locale, focus, t, onChange, onReset, onPickText, onTextNameChange, onTextChange, onTextRemove }: {
  draft: SkinManifestV1
  locale: SkinLocale
  focus: CopyEditorFocus | null
  t: Translate
  onChange: (slotId: CopySlotId, language: SkinLocale, value: string) => void
  onReset: (slotId: CopySlotId) => void
  onPickText: () => void
  onTextNameChange: (ruleId: string, value: string) => void
  onTextChange: (ruleId: string, language: SkinLocale, value: string) => void
  onTextRemove: (ruleId: string) => void
}) {
  const fixedInputs = useRef<Map<CopySlotId, HTMLInputElement>>(new Map())
  const freeInputs = useRef<Map<string, HTMLInputElement>>(new Map())
  useEffect(() => {
    if (focus === null) return
    const input = focus.kind === 'fixed' ? fixedInputs.current.get(focus.id) : freeInputs.current.get(focus.id)
    input?.scrollIntoView?.({ block: 'center' })
    input?.focus()
  }, [focus])
  return (
    <section className={css.semanticEditor} aria-labelledby="skin-studio-copy-title">
      <div className={css.semanticEditorIntro}>
        <h3 id="skin-studio-copy-title">{t('copy.title')}</h3>
        <p>{t('copy.description')}</p>
      </div>
      <div className={css.semanticRows}>
        {EDITABLE_COPY_SLOTS.map(slot => {
          const override = draft.copyOverrides[slot.id]
          const available = findCopySlotTargets(slot.id).length > 0
          return <article className={css.semanticRow} key={slot.id}>
            <div className={css.semanticRowHeading}>
              <div><strong>{slot.name[locale]}</strong><p>{slot.description[locale]}</p></div>
              <span className={css.compatibilityStatus} data-available={available || undefined}>{available ? t('slot.available') : t('slot.unavailable')}</span>
            </div>
            <div className={css.copyOriginals}>
              <span><b>{t('copy.original')} · {t('copy.language.zh')}</b>{slot.original.zh}</span>
              <span><b>{t('copy.original')} · {t('copy.language.en')}</b>{slot.original.en}</span>
            </div>
            <div className={css.copyInputs}>
              {SKIN_LOCALES.map(language => {
                const languageKey = ('copy.language.' + language) as SkinStudioKey
                return <label key={language}>
                  <span>{t(languageKey)} {t('copy.override')}</span>
                  <input
                    ref={node => { if (language === 'zh') { if (node === null) fixedInputs.current.delete(slot.id); else fixedInputs.current.set(slot.id, node) } }}
                    aria-label={slot.name[locale] + ' ' + t(languageKey) + ' ' + t('copy.override')}
                    value={override?.[language] ?? ''}
                    maxLength={slot.maxLength}
                    placeholder={t('copy.defaultHint')}
                    onChange={event => { onChange(slot.id, language, event.target.value) }}
                  />
                </label>
              })}
            </div>
            <div className={css.semanticActions}>
              <Button size="sm" disabled={override === undefined} onClick={() => { onReset(slot.id) }}>{t('copy.restore')}</Button>
            </div>
          </article>
        })}
      </div>
      <section className={css.freeTextSection} aria-labelledby="skin-studio-free-text-title">
        <div className={css.freeTextIntro}>
          <div><h4 id="skin-studio-free-text-title">{t('text.title')}</h4><p>{t('text.description')}</p></div>
          <Button data-text-picker size="sm" variant="primary" disabled={draft.textOverrides.length >= MAX_TEXT_OVERRIDE_RULES} onClick={onPickText}>{t('text.pick')}</Button>
        </div>
        <p className={css.freeTextLimit}>{t('text.limit').replace('{count}', String(draft.textOverrides.length))}</p>
        {draft.textOverrides.length === 0 ? <p className={css.empty}>{t('text.empty')}</p> : <div className={css.freeTextList}>
          {draft.textOverrides.map(rule => {
            const available = findTextOverrideTargets(rule.target).length > 0
            return <article className={css.freeTextRule} key={rule.id}>
              <div className={css.semanticRowHeading}>
                <label className={css.freeTextName}><span>{t('text.name')}</span><input value={rule.name} maxLength={80} onChange={event => { onTextNameChange(rule.id, event.target.value) }} onBlur={() => { if (rule.name.trim() === '') onTextNameChange(rule.id, rule.sample.slice(0, 80)) }} /></label>
                <span className={css.compatibilityStatus} data-available={available || undefined}>{available ? t('slot.available') : t('slot.unavailable')}</span>
              </div>
              <p className={css.freeTextSample}><b>{t('text.sample')}</b>{rule.sample}</p>
              <div className={css.copyInputs}>
                {SKIN_LOCALES.map(language => {
                  const languageKey = ('copy.language.' + language) as SkinStudioKey
                  return <label key={language}>
                    <span>{t(languageKey)} {t('copy.override')}</span>
                    <input
                      ref={node => { if (language === 'zh') { if (node === null) freeInputs.current.delete(rule.id); else freeInputs.current.set(rule.id, node) } }}
                      aria-label={rule.name + ' ' + t(languageKey) + ' ' + t('copy.override')}
                      value={rule.replacements[language] ?? ''}
                      maxLength={MAX_TEXT_OVERRIDE_VALUE_LENGTH}
                      placeholder={t('copy.defaultHint')}
                      onChange={event => { onTextChange(rule.id, language, event.target.value) }}
                    />
                  </label>
                })}
              </div>
              <div className={css.semanticActions}><Button size="sm" onClick={() => { onTextRemove(rule.id) }}>{t('text.remove')}</Button></div>
            </article>
          })}
        </div>}
      </section>
    </section>
  )
}
