import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useOrganization } from '../context/organization'
import { ADMIN_NAV, USER_NAV } from './nav'

const OPEN_DELAY_MS = 120
const CLOSE_DELAY_MS = 250
const EASE = 'ease-[cubic-bezier(0.785,0.135,0.15,0.86)]'

// Where a link sits inside the list. Uses on-screen positions rather than offsetTop:
// a blurred list item becomes its link's offset parent, which would throw offsetTop off.
function measure(link, list) {
  const linkBox = link.getBoundingClientRect()
  return { top: linkBox.top - list.getBoundingClientRect().top, height: linkBox.height }
}

// A slim strip on the left edge. Pointing at it (or tabbing into it, or tapping
// it) slides the full menu out over the page.
export function Sidebar() {
  const { pathname } = useLocation()
  const { personLabel } = useOrganization()
  const isAdmin = pathname.startsWith('/admin')
  const items = isAdmin ? ADMIN_NAV : USER_NAV

  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(null) // { index, top, height } of the link under the pointer
  const [current, setCurrent] = useState(null) // { top, height } of the link for this page

  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const timer = useRef(null)
  const skipFocusOpen = useRef(false)

  function openAfter(value, delay) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(value), delay)
  }

  function openNow(value) {
    clearTimeout(timer.current)
    setOpen(value)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  // Touch screens have no "pointer left", so a tap outside closes the menu.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event) {
      if (!containerRef.current.contains(event.target)) openNow(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Place the active marker on the link for the current page. Re-measure when the
  // list resizes too: the menu is hidden on narrow screens, where links measure 0.
  useLayoutEffect(() => {
    const list = listRef.current
    const update = () => {
      const link = list.querySelector('[aria-current="page"]')
      setCurrent(link?.offsetHeight ? measure(link, list) : null)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => observer.disconnect()
  }, [pathname])

  // The highlight and the blur both follow this one piece of state, so they always agree.
  const track = (event, index) => setHover({ index, ...measure(event.currentTarget, listRef.current) })

  const highlight = hover ?? current

  return (
    <div
      ref={containerRef}
      className="fixed inset-y-0 left-0 z-40 hidden md:block"
      onMouseEnter={() => openAfter(true, OPEN_DELAY_MS)}
      onMouseLeave={() => {
        openAfter(false, CLOSE_DELAY_MS)
        setHover(null)
      }}
      onFocus={() => {
        if (skipFocusOpen.current) skipFocusOpen.current = false
        else openNow(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) openNow(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        openNow(false)
        skipFocusOpen.current = true
        triggerRef.current.focus()
      }}
    >
      {/* The strip that stays on screen. */}
      <div className="relative z-10 flex h-full w-12 flex-col border-r border-line/70 bg-surface/80 backdrop-blur-xl">
        <div className="h-14 shrink-0 border-b border-line/70" />
        <button
          ref={triggerRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => openNow(true)}
          className="relative flex flex-1 items-center justify-center text-ink-subtle transition-colors hover:text-ink"
        >
          <span aria-hidden="true" className="flex h-7 w-4 items-center justify-between">
            <span className={`h-full w-[2px] bg-current transition-all duration-300 ${open ? '-translate-y-1.5 opacity-0' : ''}`} />
            <span className={`h-full w-[2px] origin-bottom bg-current transition-all duration-300 ${open ? 'scale-y-125 text-ink' : ''}`} />
            <span className={`h-full w-[2px] bg-current transition-all duration-300 ${open ? '-translate-y-1.5 opacity-0' : ''}`} />
          </span>
          <span
            aria-hidden="true"
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -rotate-90 text-[10px] font-semibold tracking-[0.25em] text-ink-muted transition-all duration-300 ${
              open ? 'translate-y-12 opacity-100' : 'translate-y-16 opacity-0'
            }`}
          >
            MENU
          </span>
        </button>
      </div>

      {/* The menu that slides out over the page. */}
      <nav
        id="main-menu"
        aria-label="Main"
        inert={!open}
        className={`absolute inset-y-0 left-12 flex w-64 flex-col border-r border-line/70 bg-surface/90 shadow-[16px_0_40px_-28px_rgba(22,24,29,0.45)] backdrop-blur-xl transition-transform duration-500 motion-reduce:transition-none ${EASE} ${
          open ? 'translate-x-0' : '-translate-x-[calc(100%+3rem)]'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            {isAdmin ? 'Administration' : personLabel}
          </p>
        </div>

        <div className="flex-1 px-3 py-5">
          <ul ref={listRef} onMouseLeave={() => setHover(null)} className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 rounded-sm bg-ink/[0.05] transition-[transform,height,opacity] duration-200 ease-out motion-reduce:transition-none"
              style={{
                transform: `translateY(${highlight?.top ?? 0}px)`,
                height: highlight?.height ?? 0,
                opacity: hover ? 1 : 0,
              }}
            />
            {current && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 -left-3 w-[3px] bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateY(${current.top + 6}px)`, height: current.height - 12 }}
              />
            )}

            {items.map(({ to, label, icon: Icon }, index) => (
              <li
                key={to}
                className={`py-px transition-[filter,opacity] duration-200 motion-reduce:transition-none ${
                  hover && hover.index !== index ? 'opacity-60 blur-[2px]' : ''
                }`}
              >
                <NavLink
                  to={to}
                  onMouseEnter={(event) => track(event, index)}
                  onFocus={(event) => track(event, index)}
                  onBlur={() => setHover(null)}
                  onClick={() => openNow(false)}
                  className={({ isActive }) =>
                    `group relative flex h-9 items-center overflow-hidden rounded-sm px-2.5 text-sm transition-colors duration-200 ${
                      isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-muted hover:text-ink'
                    }`
                  }
                >
                  {/* Labels rise into place one after another as the menu opens. */}
                  <span
                    className={`flex items-center gap-3 transition-[translate,opacity] duration-500 motion-reduce:transition-none ${EASE} ${
                      open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                    }`}
                    style={{ transitionDelay: open ? `${120 + index * 60}ms` : '0ms' }}
                  >
                    <Icon
                      className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                      strokeWidth={1.75}
                    />
                    {label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  )
}
