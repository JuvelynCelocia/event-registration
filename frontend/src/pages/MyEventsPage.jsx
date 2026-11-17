import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../components/Modal'
import { PageLoader } from '../components/ProtectedRoute'
import { TicketModal } from '../components/TicketModal'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, formatTimeRange, isPastDate } from '../lib/format'

function RegistrationCard({ registration, onCancel, onViewTicket, canCancel }) {
  const event = registration.event

  return (
    <article className="card page-enter flex flex-col overflow-hidden md:flex-row md:items-stretch">
      <div className="ph h-[160px] w-full flex-none md:h-auto md:w-[240px]">
        <Icon name="image" className="h-12 w-12" strokeWidth={1.5} />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 md:py-6 md:pl-0 md:pr-0">
        <div className="flex-1 md:pl-6">
          <span className="badge">Registered</span>
          <h3 className="mt-2.5 text-[22px] font-bold leading-tight md:text-[24px]">{event.title}</h3>
          <div className="meta">
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
      </div>

      <div className="flex flex-col justify-between gap-4 border-t-[1.5px] border-line p-5 md:min-w-[240px] md:items-end md:border-t-0 md:py-6 md:pl-6 md:pr-6">
        <div className="text-[15px] text-mute md:text-right">
          {registration.attendees} attendee(s)
          <br />
          Ref. <b className="text-ink">{registration.reference}</b>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canCancel ? (
            <button type="button" className="btn btn-alt btn-sm flex-1 md:flex-none" onClick={() => onCancel(registration)}>
              Cancel
            </button>
          ) : null}
          <button type="button" className="btn btn-sm flex-1 md:flex-none" onClick={() => onViewTicket(registration)}>
            View ticket
          </button>
        </div>
      </div>
    </article>
  )
}

export function MyEventsPage() {
  const { toast } = useToast()
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('upcoming')
  const [ticket, setTicket] = useState(null)
  const [pendingCancel, setPendingCancel] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    document.title = 'My events · Event Registration App'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api('/registrations', { signal: controller.signal })
      .then((data) => setRegistrations(data.registrations || []))
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        setError(requestError.message || 'Could not load your registrations.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const { upcoming, past } = useMemo(() => {
    const next = []
    const previous = []
    for (const registration of registrations) {
      if (isPastDate(registration.event.date)) {
        previous.push(registration)
      } else {
        next.push(registration)
      }
    }
    return { upcoming: next, past: previous }
  }, [registrations])

  const visible = tab === 'upcoming' ? upcoming : past

  async function confirmCancel() {
    if (!pendingCancel) return
    setCancelling(true)
    try {
      await api(`/registrations/${pendingCancel.id}`, { method: 'DELETE' })
      setRegistrations((current) => current.filter((item) => item.id !== pendingCancel.id))
      toast('Your registration has been cancelled.', 'info')
      setPendingCancel(null)
    } catch (requestError) {
      toast(requestError.message || 'Could not cancel that registration.', 'danger')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader label="Loading your events…" />

  return (
    <div className="page-enter">
      <h1 className="mb-5 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">My events</h1>

      <div className="mb-7 flex gap-6 border-b border-line" role="tablist" aria-label="My events">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'past', label: 'Past', count: past.length },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px px-1 py-2.5 font-semibold transition ${
              tab === item.id ? 'tab-on' : 'text-mute hover:text-ink'
            }`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border-[1.5px] border-danger bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {visible.length ? (
        <div className="grid gap-5">
          {visible.map((registration) => (
            <RegistrationCard
              key={registration.id}
              registration={registration}
              canCancel={tab === 'upcoming'}
              onCancel={setPendingCancel}
              onViewTicket={setTicket}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={tab === 'upcoming' ? 'calendar' : 'calendar-x'}
          title={tab === 'upcoming' ? 'No upcoming events yet' : 'No past events yet'}
          action={
            tab === 'upcoming' ? (
              <Link to="/register" className="btn">
                Find an event
              </Link>
            ) : null
          }
        >
          {tab === 'upcoming'
            ? 'When you register for an event, your ticket and attendee details will appear here.'
            : 'Events you attended will be listed here once their date has passed.'}
        </EmptyState>
      )}

      <TicketModal registration={ticket} open={Boolean(ticket)} onClose={() => setTicket(null)} />

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        onClose={() => (cancelling ? null : setPendingCancel(null))}
        onConfirm={confirmCancel}
        busy={cancelling}
        icon="calendar-x"
        title="Cancel your registration?"
        confirmLabel="Cancel registration"
        cancelLabel="Keep registration"
      >
        {pendingCancel
          ? `You’ll lose your spot at ${pendingCancel.event.title} (${pendingCancel.attendees} attendee${
              pendingCancel.attendees === 1 ? '' : 's'
            }, Ref. ${pendingCancel.reference}).`
          : null}
      </ConfirmDialog>
    </div>
  )
}
