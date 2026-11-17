import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EventSummary } from '../components/EventCard'
import { Alert, SelectField, TextField } from '../components/Form'
import { Icon } from '../components/Icon'
import { PageLoader } from '../components/ProtectedRoute'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, formatTimeRange } from '../lib/format'

export function EditRegistrationPage() {
  const { id } = useParams()
  const { toast } = useToast()

  const [registration, setRegistration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notAllowed, setNotAllowed] = useState(false)

  const [form, setForm] = useState({ full_name: '', email: '', contact: '', attendees: 1 })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')

    api(`/registrations/${id}`, { signal: controller.signal })
      .then((data) => {
        const loaded = data.registration
        setRegistration(loaded)
        setForm({
          full_name: loaded.full_name,
          email: loaded.email,
          contact: loaded.contact,
          attendees: loaded.attendees,
        })
        document.title = `Edit registration · ${loaded.event.title}`
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setNotAllowed(error.status === 403)
        document.title = 'Registration not available · Event Registration App'
        setLoadError(
          error.status === 403
            ? 'You do not have access to that registration.'
            : error.status === 404
              ? 'That registration could not be found.'
              : error.message,
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [id])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setUpdated(false)
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError('')
    setUpdated(false)

    try {
      const data = await api(`/registrations/${id}`, {
        method: 'PUT',
        body: {
          full_name: form.full_name,
          email: form.email,
          contact: form.contact,
          attendees: Number(form.attendees),
        },
      })
      setRegistration(data.registration)
      setForm({
        full_name: data.registration.full_name,
        email: data.registration.email,
        contact: data.registration.contact,
        attendees: data.registration.attendees,
      })
      setUpdated(true)
      toast('Registration updated.')
    } catch (error) {
      setErrors(error.errors || {})
      setFormError(error.message || 'Could not update your registration.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader label="Loading registration…" />

  if (!registration) {
    return (
      <div className="rounded-2xl border-[1.5px] border-dashed border-line p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-accent">
          <Icon name={notAllowed ? 'lock' : 'calendar-x'} className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Registration not available</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-mute">{loadError}</p>
        <Link to="/my-events" className="btn mt-5">
          Back to My events
        </Link>
      </div>
    )
  }

  const event = registration.event
  const maxAttendees = Math.max(1, Math.min(10, event.capacity || 10))

  return (
    <div className="page-enter">
      <Link to="/my-events" className="inline-flex items-center gap-2 font-semibold transition hover:text-accent">
        <Icon name="back" className="h-5 w-5" />
        Event registration
      </Link>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
        <EventSummary event={event} />

        <section className="card p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[26px] font-bold leading-tight md:text-[28px]">Edit registration</h1>
            <span className="badge">{registration.reference}</span>
          </div>
          <div className="mt-3 rounded-xl bg-bg p-4">
            <div className="meta mt-0">
              <Icon name="calendar" className="h-5 w-5 flex-none" />
              {formatDate(event.date)}
            </div>
            <div className="meta">
              <Icon name="clock" className="h-5 w-5 flex-none" />
              {formatTimeRange(event.start_time, event.end_time)}
            </div>
          </div>

          {formError ? (
            <Alert tone="danger" className="mt-5" title="Could not update registration">
              {formError}
            </Alert>
          ) : null}

          <form onSubmit={submit} className="mt-5" noValidate>
            <TextField
              id="edit-name"
              label="Full name *"
              placeholder="Enter your full name"
              autoComplete="name"
              value={form.full_name}
              error={errors.full_name}
              onChange={(event_) => update('full_name', event_.target.value)}
              required
            />
            <TextField
              id="edit-email"
              label="Email address *"
              type="email"
              placeholder="Enter your email address"
              autoComplete="email"
              value={form.email}
              error={errors.email}
              onChange={(event_) => update('email', event_.target.value)}
              required
            />
            <TextField
              id="edit-contact"
              label="Contact number *"
              type="tel"
              placeholder="Enter your contact number"
              autoComplete="tel"
              value={form.contact}
              error={errors.contact}
              onChange={(event_) => update('contact', event_.target.value)}
              required
            />
            <SelectField
              id="edit-attendees"
              label="Number of attendees *"
              value={form.attendees}
              error={errors.attendees}
              onChange={(event_) => update('attendees', event_.target.value)}
            >
              {Array.from({ length: maxAttendees }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? 'attendee' : 'attendees'}
                </option>
              ))}
            </SelectField>

            <button type="submit" className="btn mt-2 w-full" disabled={saving}>
              {saving ? 'Updating…' : 'Update registration'}
            </button>
          </form>

          {updated ? (
            <Alert tone="success" className="mt-5" title="Registration updated!">
              Your changes have been saved.
            </Alert>
          ) : null}

          <p className="mt-4 text-center text-sm text-mute">
            <Link to="/my-events" className="font-semibold text-accent underline underline-offset-2">
              Back to My events
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}
