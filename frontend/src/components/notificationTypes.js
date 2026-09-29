import { Activity, CircleCheck, ListOrdered } from 'lucide-react'

export const NOTIFICATION_TYPES = {
  queue_update: { label: 'Queue update', icon: ListOrdered },
  status_change: { label: 'Status change', icon: Activity },
  service_update: { label: 'Service update', icon: CircleCheck },
}
