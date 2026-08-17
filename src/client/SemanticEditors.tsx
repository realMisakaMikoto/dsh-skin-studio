import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SkinManifestV1 } from '../model.ts'
import {
  COPY_SLOTS, SKIN_LOCALES, VISUAL_ASSET_SLOTS,
  type CopySlotId, type SkinLocale, type VisualAssetSlotId,
} from '../skin-slots.ts'
import { findCopySlotTargets, findVisualSlotTargets } from './semantic-slots.ts'
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

export function VisualAssetEditor({ draft, assets, locale, error, t, onPick, onRemove }: {
  draft: SkinManifestV1
  assets: ReadonlyMap<string, Blob>
  locale: SkinLocale
  error: 'invalid' | 'too-large' | null
  t: Translate
  onPick: (slotId: VisualAssetSlotId, file: File | undefined) => void
  onRemove: (slotId: VisualAssetSlotId) => void
}) {
  const inputs = useRef<Map<VisualAssetSlotId, HTMLInputElement>>(new Map())
  return (
    <section className={css.semanticEditor} aria-labelledby="skin-studio-visual-title">
      <div className={css.semanticEditorIntro}>
        <h3 id="skin-studio-visual-title">{t('visual.title')}</h3>
        <p>{t('visual.description')}</p>
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

export function CopyOverrideEditor({ draft, locale, t, onChange, onReset }: {
  draft: SkinManifestV1
  locale: SkinLocale
  t: Translate
  onChange: (slotId: CopySlotId, language: SkinLocale, value: string) => void
  onReset: (slotId: CopySlotId) => void
}) {
  return (
    <section className={css.semanticEditor} aria-labelledby="skin-studio-copy-title">
      <div className={css.semanticEditorIntro}>
        <h3 id="skin-studio-copy-title">{t('copy.title')}</h3>
        <p>{t('copy.description')}</p>
      </div>
      <div className={css.semanticRows}>
        {COPY_SLOTS.map(slot => {
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
    </section>
  )
}
