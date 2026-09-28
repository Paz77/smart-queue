const VARIANTS = {
  primary: 'border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-sunken',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-stone-100 hover:text-ink',
  danger: 'border-red-200 bg-surface text-red-700 hover:border-red-300 hover:bg-red-50',
  'danger-solid': 'border-red-700 bg-red-700 text-white hover:border-red-800 hover:bg-red-800',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
  md: 'h-9 px-4 text-sm [&_svg]:size-4',
}

// Pass as={Link} to="/somewhere" to render a router link styled as a button.
export function Button({ variant = 'primary', size = 'md', as: Component = 'button', className = '', ...props }) {
  return (
    <Component
      {...(Component === 'button' && { type: 'button' })}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
