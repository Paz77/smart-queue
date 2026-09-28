const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

// A function because notification times are relative to now.
export function createNotifications() {
  return [
    // Northgate Student Services
    { id: 'n-4', userId: 'u-1', organizationId: 'org-northgate', type: 'queue_update', title: 'You moved up in line', message: 'Academic Advising: you are now 4th in line.', createdAt: minutesAgo(6), read: false },
    { id: 'n-3', userId: 'u-1', organizationId: 'org-northgate', type: 'queue_update', title: 'Career Services has closed', message: 'This queue is not accepting new visitors for the rest of the day.', createdAt: minutesAgo(12), read: false },
    { id: 'n-2', userId: 'u-1', organizationId: 'org-northgate', type: 'queue_update', title: 'Joined Academic Advising', message: 'You are 5th in line. Estimated wait is 1 hr 15 min.', createdAt: minutesAgo(18), read: true },
    { id: 'n-1', userId: 'u-1', organizationId: 'org-northgate', type: 'status_change', title: 'Registrar visit complete', message: 'You were served on Sep 23 at 2:21 PM.', createdAt: '2026-09-23T14:21:00', read: true },

    // Riverside Family Clinic
    { id: 'n-8', userId: 'u-1', organizationId: 'org-riverside', type: 'queue_update', title: 'You moved up in line', message: 'General Consultation: you are now 3rd in line.', createdAt: minutesAgo(4), read: false },
    { id: 'n-7', userId: 'u-1', organizationId: 'org-riverside', type: 'queue_update', title: 'Joined General Consultation', message: 'You are 4th in line. Estimated wait is 1 hr.', createdAt: minutesAgo(12), read: true },
    { id: 'n-6', userId: 'u-1', organizationId: 'org-riverside', type: 'queue_update', title: 'Physical Therapy Intake is closed', message: 'New intake visits resume tomorrow morning.', createdAt: minutesAgo(30), read: false },
    { id: 'n-5', userId: 'u-1', organizationId: 'org-riverside', type: 'status_change', title: 'Pharmacy visit complete', message: 'You were served on Sep 21 at 4:16 PM.', createdAt: '2026-09-21T16:16:00', read: true },
  ]
}
