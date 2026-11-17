import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EventCard'
import { Alert, TextAreaField, TextField } from '../components/Form'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../components/Modal'
import { PageLoader } from '../components/ProtectedRoute'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, formatTimeRange, toDateInputValue } from '../lib/format'

const emptyForm = {
  title: '',
  date: '',
  start_time: '09:00',
  end_time: '17:00',
  location: '',
  capacity: 100,
  description: '',
}

function eventToForm(event) {
  return {
    title: event.title,
    date: toDateInputValue(event.date),
    start_time: event.start_time,
    end_time: event.end_time,
    location: event.location,
    capacity: event.capacity,
    description: event.description || '',
  }
}

export function ManageEventsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    document.title = 'Manage events · Event Registration App'
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    api('/events', { signal: controller.signal })
      .then((data) => setEvents(data.events || []))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setLoadError(error.message || 'Could not load events.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [isAdmin])

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)),
    [events],
  )

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startEditing(event) {
    setEditingId(event.id)
    setForm(eventToForm(event))
    setErrors({})
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError('')

    const body = {
      title: form.title,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location,
      capacity: Number(form.capacity),
      description: form.description,
    }

    try {
      const data = editingId
        ? await api(`/events/${editingId}`, { method: 'PUT', body })
        : await api('/events', { method: 'POST', body })

      setEvents((current) => {
        if (editingId) {
          return current.map((item) => (item.id === editingId ? data.event : item))
        }
        return [...current, data.event]
      })
      toast(editingId ? 'Event updated.' : 'Event created.')
      cancelEditing()
    } catch (error) {
      setErrors(error.errors || {})
      setFormError(error.message || 'Could not save that event.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api(`/events/${pendingDelete.id}`, { method: 'DELETE' })
      setEvents((current) => current.filter((item) => item.id !== pendingDelete.id))
      if (editingId === pendingDelete.id) cancelEditing()
      toast('Event deleted.', 'info')
      setPendingDelete(null)
    } catch (error) {
      toast(error.message || 'Could not delete that event.', 'danger')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon="lock"
        title="Administrator access required"
        action={
          <Link to="/more" className="btn">
            Back to More
          </Link>
        }
      >
        Managing events is limited to administrator accounts. Sign in with the admin demo account to add, edit or
        delete events.
      </EmptyState>
    )
  }

  if (loading) return <PageLoader label="Loading events…" />

  return (
    <div className="page-enter">
      <h1 className="mb-7 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">Manage events</h1>

      {loadError ? (
        <div className="mb-6 rounded-2xl border-[1.5px] border-danger bg-danger-bg p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[24px] font-bold md:text-[26px]">{editingId ? 'Edit event' : 'Add event'}</h2>
            {editingId ? <span className="badge">Editing</span> : null}
          </div>

          {formError ? (
            <Alert tone="danger" className="mt-5" title="Could not save event">
              {formError}
            </Alert>
          ) : null}

          <form onSubmit={submit} className="mt-5" noValidate>
            <TextField
              id="event-title"
              label="Event title *"
              placeholder="e.g. Hackathon 2027"
              value={form.title}
              error={errors.title}
              onChange={(event) => update('title', event.target.value)}
              required
            />
            <TextField
              id="event-date"
              label="Date *"
              type="date"
              value={form.date}
              error={errors.date}
              onChange={(event) => update('date', event.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="event-start"
                label="Start time *"
                type="time"
                value={form.start_time}
                error={errors.start_time}
                onChange={(event) => update('start_time', event.target.value)}
                required
              />
              <TextField
                id="event-end"
                label="End time *"
                type="time"
                value={form.end_time}
                error={errors.end_time}
                onChange={(event) => update('end_time', event.target.value)}
                required
              />
            </div>
            <TextField
              id="event-location"
              label="Location *"
              placeholder="Main Hall, City Campus"
              value={form.location}
              error={errors.location}
              onChange={(event) => update('location', event.target.value)}
              required
            />
            <TextField
              id="event-capacity"
              label="Capacity *"
              type="number"
              min="1"
              max="10000"
              placeholder="100"
              value={form.capacity}
              error={errors.capacity}
              onChange={(event) => update('capacity', event.target.value)}
              required
            />
            <TextAreaField
              id="event-description"
              label="Description"
              placeholder="What should attendees know about this event?"
              value={form.description}
              error={errors.description}
              onChange={(event) => update('description', event.target.value)}
            />

            <button type="submit" className="btn w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save event'}
            </button>
            {editingId ? (
              <button type="button" className="btn btn-alt mt-3 w-full" onClick={cancelEditing} disabled={saving}>
                Cancel editing
              </button>
            ) : null}
          </form>
        </section>

        <section className="grid gap-3.5">
          {sortedEvents.length ? (
            sortedEvents.map((event) => {
              const active = editingId === event.id
              return (
                <div
                  key={event.id}
                  className={`card flex flex-wrap items-center gap-3 p-4 md:px-5 ${
                    active ? 'border-[2px] border-accent' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <b className="block text-[17px] leading-snug md:text-[18px]">{event.title}</b>
                    <div className="meta mt-1.5">
                      <Icon name="calendar" className="h-4 w-4 flex-none" />
                      {formatDate(event.date)}
                      <span className="text-mute/70">· {formatTimeRange(event.start_time, event.end_time)}</span>
                    </div>
                    <div className="meta mt-1">
                      <Icon name="pin" className="h-4 w-4 flex-none" />
                      {event.location}
                    </div>
                    <p className="mt-2 text-xs font-medium text-mute">
                      {event.registered_count} of {event.capacity} spots filled
                    </p>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button type="button" className="btn btn-alt btn-sm flex-1 sm:flex-none" onClick={() => startEditing(event)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-alt btn-sm flex-1 text-danger sm:flex-none"
                      onClick={() => setPendingDelete(event)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState title="No events yet" icon="calendar">
              Add your first event with the form on the left. It will appear here and on the events dashboard.
            </EmptyState>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => (deleting ? null : setPendingDelete(null))}
        onConfirm={confirmDelete}
        busy={deleting}
        icon="trash"
        title="Delete this event?"
        confirmLabel="Delete event"
      >
        {pendingDelete
          ? `${pendingDelete.title} and any registrations for it will be removed. This can’t be undone.`
          : null}
      </ConfirmDialog>
    </div>
  )
}
