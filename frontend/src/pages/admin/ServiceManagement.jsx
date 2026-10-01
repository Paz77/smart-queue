import { Clock, Plus, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { NumberField } from '../../components/NumberField'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge } from '../../components/PriorityBadge'
import { SelectField } from '../../components/SelectField'
import { StatusDot } from '../../components/StatusDot'
import { TextAreaField } from '../../components/TextAreaField'
import { TextField } from '../../components/TextField'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { STATUS_META } from '../../utils/status'

const NAME_MAX_LENGTH = 100
const DURATION_MIN = 1
const DURATION_MAX = 480
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]
const FIELDS = ['name', 'description', 'expectedDuration', 'priority']
const EMPTY = { name: '', description: '', expectedDuration: '', priority: '' }

// Each check returns an error message, or '' when the value is fine.
function validate(field, value) {
  switch (field) {
    case 'name':
      if (!value.trim()) return 'Enter a service name.'
      return value.length > NAME_MAX_LENGTH ? `Service name can't be longer than ${NAME_MAX_LENGTH} characters.` : ''
    case 'description':
      return value.trim() ? '' : 'Enter a description.'
    case 'expectedDuration': {
      const text = value.trim()
      const minutes = Number(text)
      return /^\d+$/.test(text) && minutes >= DURATION_MIN && minutes <= DURATION_MAX
        ? ''
        : `Enter a whole number of minutes from ${DURATION_MIN} to ${DURATION_MAX}.`
    }
    case 'priority':
      return PRIORITY_OPTIONS.some((option) => option.value === value) ? '' : 'Choose a priority level.'
    default:
      return ''
  }
}

// Form values are all strings; the service stores a trimmed name and description and a number of minutes.
const toValues = (service) => ({
  name: service.name,
  description: service.description,
  expectedDuration: String(service.expectedDuration),
  priority: service.priority,
})

const toFields = (values) => ({
  name: values.name.trim(),
  description: values.description.trim(),
  expectedDuration: Number(values.expectedDuration),
  priority: values.priority,
})

export default function ServiceManagement() {
  const { services, createService, updateService } = useQueue()
  const [searchParams, setSearchParams] = useSearchParams()
  // Bumped whenever the admin picks what to work on, so the form puts the cursor in its first field.
  const [focusRequest, setFocusRequest] = useState(0)

  // ?edit=<id> puts the form in edit mode; the overview's Edit buttons link here that way.
  const editing = services.find((s) => s.id === searchParams.get('edit')) ?? null

  function select(serviceId) {
    setSearchParams(serviceId ? { edit: serviceId } : {})
    setFocusRequest((n) => n + 1)
  }

  function handleSave(fields) {
    if (editing) updateService(editing.id, fields)
    else createService(fields)
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Services"
        description="Create services and change how they run."
        actions={
          <Button onClick={() => select(null)}>
            <Plus />
            New service
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ServiceList services={services} editingId={editing?.id} onEdit={select} />
        <ServiceForm
          key={editing?.id ?? 'new'}
          service={editing}
          focusRequest={focusRequest}
          onSave={handleSave}
          onCancel={() => select(null)}
        />
      </div>
    </>
  )
}

function ServiceList({ services, editingId, onEdit }) {
  const openCount = services.filter((s) => s.isOpen).length
  const count = `${services.length} ${services.length === 1 ? 'service' : 'services'}`

  return (
    <Card>
      <CardHeader title="All services" description={services.length ? `${count}, ${openCount} open` : 'Nothing here yet.'} />

      {services.length === 0 ? (
        <EmptyState icon={Settings2} title="No services yet" description="Use the form to add the first one." />
      ) : (
        <ul className="divide-y divide-line">
          {services.map((service) => {
            const selected = service.id === editingId
            const status = STATUS_META[service.isOpen ? 'open' : 'closed']
            return (
              <li
                key={service.id}
                aria-current={selected || undefined}
                className={`relative flex items-center gap-3 py-3 pr-3 pl-5 transition-colors ${
                  selected ? 'bg-accent-soft' : 'hover:bg-sunken'
                }`}
              >
                {selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-accent" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${selected ? 'text-accent' : 'text-ink'}`}>{service.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <PriorityBadge priority={service.priority} />
                    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                      <Clock aria-hidden="true" className="size-3 text-ink-subtle" />
                      {service.expectedDuration} min
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <StatusDot className={status.dot} pulse={service.isOpen} />
                      {status.label}
                    </span>
                  </div>
                </div>
                {selected ? (
                  <span className="px-3 text-xs font-medium text-accent">Editing</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(service.id)} aria-label={`Edit ${service.name}`}>
                    Edit
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// Creates a service when service is null, otherwise edits it.
// The page remounts this (via key) when the admin switches service, which resets the fields.
function ServiceForm({ service, focusRequest, onSave, onCancel }) {
  const { organization } = useOrganization()
  const [values, setValues] = useState(() => (service ? toValues(service) : EMPTY))
  const [errors, setErrors] = useState(EMPTY)
  const nameRef = useRef(null)

  useEffect(() => {
    if (focusRequest) nameRef.current?.focus()
  }, [focusRequest])

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    // Only re-check fields that already show an error, so nothing turns red while typing.
    setErrors((current) => (current[name] ? { ...current, [name]: validate(name, value) } : current))
  }

  function handleBlur(event) {
    const { name, value } = event.target
    setErrors((current) => ({ ...current, [name]: validate(name, value) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = Object.fromEntries(FIELDS.map((field) => [field, validate(field, values[field])]))
    setErrors(nextErrors)

    const firstInvalid = FIELDS.find((field) => nextErrors[field])
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid).focus()
      return
    }

    const fields = toFields(values)
    onSave(fields)
    // After creating, clear the form for the next one; after editing, keep the saved values.
    setValues(service ? toValues(fields) : EMPTY)
  }

  const fieldProps = (name) => ({ name, value: values[name], error: errors[name], onChange: handleChange, onBlur: handleBlur })

  return (
    <Card>
      <CardHeader
        title={service ? 'Edit service' : 'New service'}
        description={service ? service.name : 'All fields are required.'}
      />
      <form noValidate onSubmit={handleSubmit}>
        <div className="space-y-5 p-5">
          <TextField
            ref={nameRef}
            label="Service name"
            autoComplete="off"
            hint={`${values.name.length}/${NAME_MAX_LENGTH}`}
            hintError={values.name.length > NAME_MAX_LENGTH}
            {...fieldProps('name')}
          />
          <TextAreaField
            label="Description"
            placeholder={`What can ${organization.personPlural.toLowerCase()} get help with here?`}
            {...fieldProps('description')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              label={
                <>
                  Expected duration<span className="sr-only"> in minutes</span>
                </>
              }
              hint={`${DURATION_MIN} to ${DURATION_MAX}`}
              suffix="min"
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={1}
              {...fieldProps('expectedDuration')}
            />
            <SelectField
              label="Priority level"
              placeholder="Choose a priority"
              options={PRIORITY_OPTIONS}
              {...fieldProps('priority')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken/80 px-5 py-3">
          {service && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">{service ? 'Save changes' : 'Create service'}</Button>
        </div>
      </form>
    </Card>
  )
}
