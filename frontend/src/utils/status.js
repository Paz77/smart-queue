// Labels and colors for live queue statuses and past-visit outcomes.
export const STATUS_META = {
  waiting: {
    label: 'Waiting',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  almost_ready: {
    label: 'Almost ready',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  served: {
    label: 'Served',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  left: {
    label: 'Left queue',
    className: 'bg-stone-100 text-stone-600 border-stone-200',
    dot: 'bg-stone-400',
  },
  no_show: {
    label: 'No-show',
    className: 'bg-red-50 text-red-800 border-red-200',
    dot: 'bg-red-500',
  },
}

export const STATUS_STEPS = ['waiting', 'almost_ready', 'served']

// You are "almost ready" once you are one of the next two people.
export function statusForPosition(position) {
  if (position <= 0) return 'served'
  if (position <= 2) return 'almost_ready'
  return 'waiting'
}
