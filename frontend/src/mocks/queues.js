const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

// One row per person waiting. Position 1 is the front of the line.
// A function because join times are relative to now.
export function createQueueEntries() {
  return [
    // Northgate Student Services
    { id: 'q-1', serviceId: 'svc-advising', userId: 'u-2', userName: 'Priya Shah', position: 1, joinedAt: minutesAgo(41), status: 'almost_ready' },
    { id: 'q-2', serviceId: 'svc-advising', userId: 'u-3', userName: 'Marcus Webb', position: 2, joinedAt: minutesAgo(33), status: 'almost_ready' },
    { id: 'q-3', serviceId: 'svc-advising', userId: 'u-4', userName: 'Elena Park', position: 3, joinedAt: minutesAgo(26), status: 'waiting' },
    { id: 'q-4', serviceId: 'svc-advising', userId: 'u-1', userName: 'Jordan Lee', position: 4, joinedAt: minutesAgo(18), status: 'waiting' },
    { id: 'q-5', serviceId: 'svc-advising', userId: 'u-5', userName: 'Sam Okafor', position: 5, joinedAt: minutesAgo(9), status: 'waiting' },
    { id: 'q-6', serviceId: 'svc-finaid', userId: 'u-4', userName: 'Elena Park', position: 1, joinedAt: minutesAgo(22), status: 'almost_ready' },
    { id: 'q-7', serviceId: 'svc-finaid', userId: 'u-3', userName: 'Marcus Webb', position: 2, joinedAt: minutesAgo(14), status: 'almost_ready' },
    { id: 'q-8', serviceId: 'svc-it', userId: 'u-5', userName: 'Sam Okafor', position: 1, joinedAt: minutesAgo(6), status: 'almost_ready' },

    // Riverside Family Clinic
    { id: 'q-9', serviceId: 'svc-consult', userId: 'u-6', userName: 'Aisha Rahman', position: 1, joinedAt: minutesAgo(28), status: 'almost_ready' },
    { id: 'q-10', serviceId: 'svc-consult', userId: 'u-7', userName: 'Tom Becker', position: 2, joinedAt: minutesAgo(21), status: 'almost_ready' },
    { id: 'q-11', serviceId: 'svc-consult', userId: 'u-1', userName: 'Jordan Lee', position: 3, joinedAt: minutesAgo(12), status: 'waiting' },
    { id: 'q-12', serviceId: 'svc-consult', userId: 'u-8', userName: 'Lucia Ferreira', position: 4, joinedAt: minutesAgo(7), status: 'waiting' },
    { id: 'q-13', serviceId: 'svc-lab', userId: 'u-9', userName: 'Noah Kim', position: 1, joinedAt: minutesAgo(5), status: 'almost_ready' },
    { id: 'q-14', serviceId: 'svc-vaccines', userId: 'u-2', userName: 'Priya Shah', position: 1, joinedAt: minutesAgo(3), status: 'almost_ready' },
  ]
}
