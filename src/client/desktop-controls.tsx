import React, { forwardRef, useId, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type KeyboardEvent } from 'react'
import css from './studio.module.css'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md'
  variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
}>(function Button({ size = 'md', variant = 'ghost', className, type = 'button', ...props }, ref) {
  return <button {...props} ref={ref} type={type} data-size={size} data-variant={variant} className={[css.button, className].filter(Boolean).join(' ')} />
})

export function DisclosureRow({ icon, title, collapsedContent, children, open = false, expandable = false, onToggle, className }: {
  icon?: ReactNode
  title: ReactNode
  collapsedContent?: ReactNode
  children?: ReactNode
  open?: boolean
  expandable?: boolean
  onToggle?: () => void
  className?: string
}) {
  return <div className={[css.disclosureRow, className].filter(Boolean).join(' ')}>
    <div className={css.disclosureHeading}>{icon}<span>{title}</span>{expandable && <button type="button" aria-expanded={open} onClick={onToggle}>{open ? '-' : '+'}</button>}</div>
    {open ? children : collapsedContent}
  </div>
}

export function IconPersonalizationOutline16() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 0 13h1.1a1.8 1.8 0 0 0 1.5-2.8l-.5-.8a.8.8 0 0 1 .7-1.2h1a2.7 2.7 0 0 0 2.7-2.8A5.8 5.8 0 0 0 8 1.5Z" stroke="currentColor" strokeWidth="1.2" /><circle cx="4.7" cy="7" r=".8" fill="currentColor" /><circle cx="7.5" cy="4.6" r=".8" fill="currentColor" /><circle cx="10.7" cy="5.3" r=".8" fill="currentColor" /></svg>
}

export function Modal({ open, onClose, title, closeLabel, closeDisabled = false, description, children, footer, className, contentClassName, onKeyDownCapture }: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  closeDisabled?: boolean
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  onKeyDownCapture?: (event: KeyboardEvent<HTMLDialogElement>) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    return () => {
      if (dialog?.open && typeof dialog.close === 'function') dialog.close()
    }
  }, [])

  return <dialog ref={dialogRef} className={[css.desktopDialog, className].filter(Boolean).join(' ')}
    role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    tabIndex={-1} data-dsh-skin-studio-ui="" onKeyDownCapture={onKeyDownCapture}
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing) {
        event.preventDefault(); event.stopPropagation(); onClose()
      }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}>
    {open && <><div className={[css.dialogContent, contentClassName].filter(Boolean).join(' ')}>
      <div className={css.dialogHeader}><h2 id={titleId}>{title}</h2><Button size="sm" className={css.dialogClose} aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg></Button></div>
      {description && <p id={descriptionId} className={css.dialogDescription}>{description}</p>}
      <div className={css.dialogBody}>{children}</div>
    </div>
    {footer !== undefined && <div className={css.dialogFooter}>{footer}</div>}</>}
  </dialog>
}
