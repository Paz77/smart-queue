import { useEffect, useRef } from 'react'

// Built on the native <dialog>, which handles focus trapping and Escape for free.
export function Modal({ open, onClose, title, description, footer, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>}
        {children}
      </div>
      {footer && <div className="mt-4 flex justify-end gap-2 border-t border-line bg-sunken px-6 py-4">{footer}</div>}
    </dialog>
  )
}
