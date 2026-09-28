// QueueSmart's mark: "QS" in a thin square, drawn in the surrounding text color.
export function Brand() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-sm border-[1.5px] border-current text-[11px] leading-none font-bold tracking-tight"
      >
        QS
      </span>
      <span className="text-[15px] font-semibold tracking-tight">QueueSmart</span>
    </span>
  )
}
