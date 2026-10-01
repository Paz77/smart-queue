import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SearchDialog } from './SearchDialog'

const isMac = () => typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')

// Search in the top bar, next to the bell. Cmd+K (Ctrl+K on Windows) opens it
// from anywhere, which is the shortcut people already expect from other apps.
export function SearchButton() {
  const [open, setOpen] = useState(false)
  const mac = isMac()

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      {/* Phones get the icon alone; from sm up it widens into a labelled field-like button. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search services and pages"
        aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
        className="flex h-8 items-center gap-2 rounded-sm border border-line-strong bg-surface px-2 text-ink-muted transition-colors hover:bg-sunken hover:text-ink sm:w-52 sm:px-2.5"
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
        <span aria-hidden="true" className="hidden flex-1 text-left text-xs sm:block">
          Search
        </span>
        <kbd
          aria-hidden="true"
          className="hidden rounded-xs border border-line bg-sunken px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-subtle sm:block"
        >
          {mac ? '⌘' : 'Ctrl'}K
        </kbd>
      </button>

      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
