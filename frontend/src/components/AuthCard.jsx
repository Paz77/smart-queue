import { CircleAlert } from 'lucide-react'
import { Brand } from './Brand'
import { Card } from './Card'
import { FogBackdrop } from './FogBackdrop'

// The centered card used by the signed-out screens (log in, register).
// `error` is a form-level message shown above the fields; `footer` sits under a divider.
export function AuthCard({ title, description, error, onSubmit, footer, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <FogBackdrop />

      <div className="mb-8">
        <Brand />
      </div>

      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} noValidate className="px-6 py-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}

          {error && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {error}
            </p>
          )}

          {children}
        </form>

        {footer && <p className="border-t border-line px-6 py-4 text-center text-xs text-ink-muted">{footer}</p>}
      </Card>
    </div>
  )
}
