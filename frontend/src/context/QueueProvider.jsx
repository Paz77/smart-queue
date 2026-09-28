import { useState } from 'react'
import { visits as seedVisits } from '../mocks/history'
import { createQueueEntries } from '../mocks/queues'
import { services as seedServices } from '../mocks/services'
import { estimateWait, formatWait, ordinal } from '../utils/format'
import { statusForPosition } from '../utils/status'
import { useAuth } from './auth'
import { useNotifications } from './notifications'
import { useOrganization } from './organization'
import { QueueContext } from './queue'

const isActive = (entry) => entry.status !== 'served'

const reposition = (entry, position) => ({ ...entry, position, status: statusForPosition(position) })

// Queue state backed by sample data. Each action below is where an API call
// will go once there is a backend; screens only talk to this context.
export function QueueProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const { addNotification } = useNotifications()
  const [services, setServices] = useState(seedServices)
  const [entries, setEntries] = useState(createQueueEntries)
  const [visits, setVisits] = useState(seedVisits)

  const getService = (serviceId) => services.find((s) => s.id === serviceId)
  const inOrganization = (serviceId) => getService(serviceId)?.organizationId === organization.id
  const organizationServices = services.filter((s) => s.organizationId === organization.id)

  const entriesFor = (serviceId) =>
    entries
      .filter((e) => e.serviceId === serviceId && isActive(e))
      .sort((a, b) => a.position - b.position)

  const mine = currentUser
    ? entries.filter((e) => e.userId === currentUser.id && inOrganization(e.serviceId))
    : []
  // The active entry if there is one, otherwise a just-served entry not yet dismissed.
  const myEntry = mine.find(isActive) ?? mine.find((e) => !isActive(e)) ?? null

  const history = currentUser
    ? visits.filter((v) => v.userId === currentUser.id && inOrganization(v.serviceId))
    : []

  const notify = (service, notification) => addNotification({ ...notification, organizationId: service.organizationId })

  const recordVisit = (entry, servedAt, outcome) =>
    setVisits((prev) => [
      { id: `v-${Date.now()}`, userId: entry.userId, serviceId: entry.serviceId, joinedAt: entry.joinedAt, servedAt, outcome },
      ...prev,
    ])

  // Tell the signed-in person that their place in line changed.
  function announceMove(service, entry, position) {
    const before = entry.status
    const after = statusForPosition(position)
    const place = `${service.name}: you are now ${ordinal(position)} in line.`
    if (after === 'almost_ready' && before !== 'almost_ready') {
      notify(service, { type: 'status_change', title: 'Almost your turn', message: `${place} Start heading to the desk.` })
    } else if (after !== before) {
      notify(service, { type: 'status_change', title: 'Your place in line changed', message: place })
    } else if (position < entry.position) {
      notify(service, { type: 'queue_update', title: 'You moved up in line', message: place })
    } else {
      notify(service, { type: 'queue_update', title: 'Your place in line changed', message: place })
    }
  }

  function joinQueue(serviceId) {
    const service = getService(serviceId)
    if (!currentUser || !service?.isOpen || mine.some(isActive)) return false

    const position = entriesFor(serviceId).length + 1
    const entry = {
      id: `q-${Date.now()}`,
      serviceId,
      userId: currentUser.id,
      userName: currentUser.name,
      position,
      joinedAt: new Date().toISOString(),
      status: statusForPosition(position),
    }
    setEntries((prev) => [...prev.filter((e) => !(e.userId === currentUser.id && !isActive(e))), entry])
    notify(service, {
      type: 'queue_update',
      title: `Joined ${service.name}`,
      message: `You are ${ordinal(position)} in line. Estimated wait is ${formatWait(estimateWait(position, service.expectedDuration))}.`,
    })
    return true
  }

  function leaveQueue() {
    const entry = mine.find(isActive)
    if (!entry) return
    const service = getService(entry.serviceId)

    setEntries((prev) =>
      prev
        .filter((e) => e.id !== entry.id)
        .map((e) =>
          e.serviceId === entry.serviceId && isActive(e) && e.position > entry.position
            ? reposition(e, e.position - 1)
            : e,
        ),
    )
    recordVisit(entry, null, 'left')
    notify(service, { type: 'status_change', title: `Left ${service.name}`, message: 'You gave up your place in line.' })
  }

  // Call a specific person to the desk; everyone behind them moves up one.
  function serveEntry(entryId) {
    const entry = entries.find((e) => e.id === entryId && isActive(e))
    if (!entry) return
    const service = getService(entry.serviceId)
    const line = entriesFor(entry.serviceId)
    const servedAt = new Date().toISOString()

    setEntries((prev) =>
      prev
        .map((e) => {
          if (e.id === entry.id) return { ...e, position: 0, status: 'served', servedAt }
          if (e.serviceId === entry.serviceId && isActive(e) && e.position > entry.position) {
            return reposition(e, e.position - 1)
          }
          return e
        })
        // Other people's served entries are done; keep only ours for the "your turn" view.
        .filter((e) => isActive(e) || e.userId === currentUser?.id),
    )

    if (entry.userId === currentUser?.id) {
      recordVisit(entry, servedAt, 'served')
      notify(service, {
        type: 'status_change',
        title: 'It is your turn',
        message: `${service.name} is ready for you. Please go to the service desk.`,
      })
      return
    }

    const me = line.find((e) => e.userId === currentUser?.id)
    if (me && me.position > entry.position) announceMove(service, me, me.position - 1)
  }

  function serveNext(serviceId) {
    const [front] = entriesFor(serviceId)
    if (front) serveEntry(front.id)
  }

  // Move someone to a new place in their line; the others shift to make room.
  function moveEntry(entryId, position) {
    const entry = entries.find((e) => e.id === entryId && isActive(e))
    if (!entry) return
    const line = entriesFor(entry.serviceId).filter((e) => e.id !== entryId)
    const target = Math.min(Math.max(position, 1), line.length + 1)
    line.splice(target - 1, 0, entry)

    const positions = new Map(line.map((e, index) => [e.id, index + 1]))
    setEntries((prev) => prev.map((e) => (positions.has(e.id) ? reposition(e, positions.get(e.id)) : e)))

    const me = line.find((e) => e.userId === currentUser?.id)
    if (me && positions.get(me.id) !== me.position) announceMove(getService(entry.serviceId), me, positions.get(me.id))
  }

  function clearServed() {
    setEntries((prev) =>
      prev.filter((e) => !(e.userId === currentUser?.id && !isActive(e) && inOrganization(e.serviceId))),
    )
  }

  // Put one organization's services, lines and visits back to the sample data.
  function resetOrganization(organizationId) {
    const ids = new Set(seedServices.filter((s) => s.organizationId === organizationId).map((s) => s.id))
    const freshEntries = createQueueEntries().filter((e) => ids.has(e.serviceId))
    setServices((prev) => [
      ...prev.filter((s) => s.organizationId !== organizationId),
      ...seedServices.filter((s) => s.organizationId === organizationId),
    ])
    setEntries((prev) => [...prev.filter((e) => !ids.has(e.serviceId)), ...freshEntries])
    setVisits((prev) => [...prev.filter((v) => !ids.has(v.serviceId)), ...seedVisits.filter((v) => ids.has(v.serviceId))])
  }

  const value = {
    services: organizationServices,
    entries,
    history,
    myEntry,
    getService,
    entriesFor,
    joinQueue,
    leaveQueue,
    serveEntry,
    serveNext,
    moveEntry,
    clearServed,
    resetOrganization,
  }

  return <QueueContext value={value}>{children}</QueueContext>
}
