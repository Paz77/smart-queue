// Past visits. servedAt is null when the person left or did not show up.
export const visits = [
  // Northgate Student Services
  { id: 'v-1', userId: 'u-1', serviceId: 'svc-registrar', joinedAt: '2026-09-23T14:05:00', servedAt: '2026-09-23T14:21:00', outcome: 'served' },
  { id: 'v-2', userId: 'u-1', serviceId: 'svc-it', joinedAt: '2026-09-22T09:40:00', servedAt: '2026-09-22T09:52:00', outcome: 'served' },
  { id: 'v-3', userId: 'u-1', serviceId: 'svc-finaid', joinedAt: '2026-09-19T11:10:00', servedAt: null, outcome: 'left' },
  { id: 'v-4', userId: 'u-1', serviceId: 'svc-advising', joinedAt: '2026-09-17T13:30:00', servedAt: '2026-09-17T14:14:00', outcome: 'served' },
  { id: 'v-5', userId: 'u-1', serviceId: 'svc-career', joinedAt: '2026-09-15T15:00:00', servedAt: null, outcome: 'no_show' },
  { id: 'v-6', userId: 'u-1', serviceId: 'svc-finaid', joinedAt: '2026-09-12T10:25:00', servedAt: '2026-09-12T11:02:00', outcome: 'served' },
  { id: 'v-7', userId: 'u-1', serviceId: 'svc-registrar', joinedAt: '2026-09-08T08:50:00', servedAt: '2026-09-08T09:01:00', outcome: 'served' },
  { id: 'v-8', userId: 'u-1', serviceId: 'svc-it', joinedAt: '2026-09-03T16:20:00', servedAt: null, outcome: 'left' },
  { id: 'v-9', userId: 'u-1', serviceId: 'svc-advising', joinedAt: '2026-08-28T10:00:00', servedAt: '2026-08-28T10:38:00', outcome: 'served' },
  { id: 'v-10', userId: 'u-1', serviceId: 'svc-career', joinedAt: '2026-08-21T13:15:00', servedAt: '2026-08-21T14:02:00', outcome: 'served' },

  // Riverside Family Clinic
  { id: 'v-11', userId: 'u-1', serviceId: 'svc-pharmacy', joinedAt: '2026-09-21T16:10:00', servedAt: '2026-09-21T16:16:00', outcome: 'served' },
  { id: 'v-12', userId: 'u-1', serviceId: 'svc-consult', joinedAt: '2026-09-10T09:05:00', servedAt: '2026-09-10T09:48:00', outcome: 'served' },
  { id: 'v-13', userId: 'u-1', serviceId: 'svc-lab', joinedAt: '2026-08-30T08:15:00', servedAt: null, outcome: 'left' },
  { id: 'v-14', userId: 'u-1', serviceId: 'svc-vaccines', joinedAt: '2026-08-19T12:40:00', servedAt: '2026-08-19T12:52:00', outcome: 'served' },
  { id: 'v-15', userId: 'u-1', serviceId: 'svc-consult', joinedAt: '2026-08-05T14:30:00', servedAt: null, outcome: 'no_show' },
]
