import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, SelectField, TextField } from '../components/Form'
import { EmptyState, EventSummary } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { PageLoader } from '../components/ProtectedRoute'
import { TicketModal } from '../components/TicketModal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, formatTimeRange, isPastDate } from '../lib/format'

export function EventRegistrationPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [event, setEvent] = useState(null)
  const [registration, setRegistration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState({ full_name: '', email: '', contact: '', attendees: 1 })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [justRegistered, setJustRegistered] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')

    api(`/events/${id}`, { signal: controller.signal })
      .then(async (data) => {
        const loaded = data.event
        setEvent(loaded)
        document.title = `${loaded.title} · Event Registration App`
        setForm({
          full_name: user?.name || '',
          email: user?.email || '',
          contact: user?.contact || '',
          attendees: 1,
        })

        if (loaded.registration_id) {
          const result = await api(`/registrations/${loaded.registration_id}`, {
            signal: controller.signal,
          })
          setRegistration(result.registration)
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setLoadError(error.status === 404 ? 'That event could not be found.' : error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
    // The form defaults only need to be seeded once per event/user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const past = event ? isPastDate(event.date) : false
  const spotsLeft = useMemo(() => {
    if (!event) return 0
    return Math.max(0, Number(event.capacity) - Number(event.registered_count || 0))
  }, [event])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event_) {
    event_.preventDefault()
    setBusy(true)
    setErrors({})
    setFormError('')

    try {
      const result = await api('/registrations', {
        method: 'POST',
        body: {
          event_id: Number(id),
          full_name: form.full_name,
          email: form.email,
          contact: form.contact,
          attendees: Number(form.attendees),
        },
      })
      setRegistration(result.registration)
      setJustRegistered(true)
      setEvent((current) =>
        current
          ? {
              ...current,
              registration_id: result.registration.id,
              registered_count: Number(current.registered_count || 0) + Number(result.registration.attendees),
            }
          : current,
      )
      toast('Registration successful!')
    } catch (error) {
      setErrors(error.errors || {})
      setFormError(error.message || 'Could not complete your registration.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader label="Loading event…" />

  if (loadError || !event) {
    return (
      <EmptyState
        title="Event not available"
        icon="calendar-x"
        action={
          <Link to="/register" className="btn">
            Browse events
          </Link>
        }
      >
        {loadError || 'That event could not be found.'}
      </EmptyState>
    )
  }

  return (
    <div className="page-enter">
      <Link to="/register" className="inline-flex items-center gap-2 font-semibold transition hover:text-accent">
        <Icon name="back" className="h-5 w-5" />
        Event registration
      </Link>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
        <EventSummary event={event} />

        {registration ? (
          <section className="card p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[26px] font-bold leading-tight md:text-[28px]">Your registration</h2>
              <span className="badge">
                <Icon name="check" className="h-4 w-4" />
                Registered
              </span>
            </div>

            {justRegistered ? (
              <Alert tone="success" className="mt-5" title="Registration successful!">
                You are now registered for {event.title}.
              </Alert>
            ) : (
              <Alert tone="success" className="mt-5" title="You’re on the list">
                You are registered for this event. Keep your reference handy.
              </Alert>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Reference</p>
                <p className="mt-1 text-lg font-extrabold tracking-wide">{registration.reference}</p>
              </div>
              <div className="rounded-xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Attendees</p>
                <p className="mt-1 text-lg font-extrabold">{registration.attendees}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border-[1.5px] border-line p-4 text-[15px]">
              <p className="font-semibold">{registration.full_name}</p>
              <p className="mt-1 text-mute">{registration.email}</p>
              <p className="text-mute">{registration.contact}</p>
            </div>

            <div className="mt-4 rounded-xl bg-bg p-4">
              <div className="meta mt-0">
                <Icon name="calendar" className="h-5 w-5 flex-none" />
                {formatDate(event.date)}
              </div>
              <div className="meta">
                <Icon name="clock" className="h-5 w-5 flex-none" />
                {formatTimeRange(event.start_time, event.end_time)}
              </div>
              <div className="meta">
                <Icon name="pin" className="h-5 w-5 flex-none" />
                {event.location}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn flex-1" onClick={() => setTicketOpen(true)}>
                <Icon name="ticket" className="h-5 w-5" />
                View ticket
              </button>
              <Link to={`/registrations/${registration.id}/edit`} className="btn btn-alt flex-1">
                <Icon name="edit" className="h-4 w-4" />
                Edit registration
              </Link>
            </div>

            <p className="mt-4 text-center text-sm text-mute">
              Need to cancel?{' '}
              <Link to="/my-events" className="font-semibold text-accent underline underline-offset-2">
                Go to My events
              </Link>
            </p>
          </section>
        ) : (
          <section className="card p-6 md:p-8">
            <h2 className="text-[26px] font-bold leading-tight md:text-[28px]">Registration form</h2>
            <p className="mt-1 text-[15px] text-mute">
              {spotsLeft > 0
                ? `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left for this event.`
                : 'This event is currently full.'}
            </p>

            {past ? (
              <Alert tone="danger" className="mt-5" title="This event has ended">
                Registration is closed because this event has already taken place.
              </Alert>
            ) : null}

            {!past && spotsLeft === 0 ? (
              <Alert tone="danger" className="mt-5" title="No spots remaining">
                This event has reached capacity. Check back later in case a spot opens up.
              </Alert>
            ) : null}

            {formError ? (
              <Alert tone="danger" className="mt-5" title="Could not register">
                {formError}
              </Alert>
            ) : null}

            <form onSubmit={submit} className={`mt-5 ${past || spotsLeft === 0 ? 'opacity-60' : ''}`} noValidate>
              <TextField
                id="reg-name"
                label="Full name *"
                placeholder="Enter your full name"
                autoComplete="name"
                value={form.full_name}
                error={errors.full_name}
                onChange={(event_) => update('full_name', event_.target.value)}
                disabled={past || spotsLeft === 0}
                required
              />
              <TextField
                id="reg-email"
                label="Email address *"
                type="email"
                placeholder="Enter your email address"
                autoComplete="email"
                value={form.email}
                error={errors.email}
                onChange={(event_) => update('email', event_.target.value)}
                disabled={past || spotsLeft === 0}
                required
              />
              <TextField
                id="reg-contact"
                label="Contact number *"
                type="tel"
                placeholder="Enter your contact number"
                autoComplete="tel"
                value={form.contact}
                error={errors.contact}
                onChange={(event_) => update('contact', event_.target.value)}
                disabled={past || spotsLeft === 0}
                required
              />
              <SelectField
                id="reg-attendees"
                label="Number of attendees *"
                value={form.attendees}
                error={errors.attendees}
                onChange={(event_) => update('attendees', event_.target.value)}
                disabled={past || spotsLeft === 0}
              >
                {Array.from({ length: Math.max(1, Math.min(10, spotsLeft || 1)) }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'attendee' : 'attendees'}
                    </option>
                  ),
                )}
              </SelectField>

              <button
                type="submit"
                className="btn mt-2 w-full"
                disabled={busy || past || spotsLeft === 0}
              >
                {busy ? 'Submitting…' : 'Submit registration'}
              </button>
            </form>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border-[1.5px] border-line bg-bg p-4">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint text-accent">
                <Icon name="info" className="h-5 w-5" />
              </span>
              <p className="text-sm leading-relaxed text-mute">
                Your registration is linked to your account. You’ll be able to view your ticket and update your
                attendee details from My events.
              </p>
            </div>
          </section>
        )}
      </div>

      <TicketModal
        registration={registration}
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
      />
    </div>
  )
}
