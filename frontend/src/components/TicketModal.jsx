import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatTimeRange } from '../lib/format'
import { Icon } from './Icon'
import { Modal } from './Modal'

export function TicketModal({ registration, open, onClose }) {
  const { user } = useAuth()
  if (!registration) return null

  const event = registration.event

  return (
    <Modal open={open} onClose={onClose} className="overflow-hidden" labelledBy="ticket-title">
      <div className="ph relative h-[128px]">
        <Icon name="ticket" className="h-12 w-12" strokeWidth={1.5} />
        <span className="badge absolute left-4 top-4 bg-card/90">Registered</span>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-card/90 text-ink transition hover:bg-card"
          aria-label="Close ticket"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="p-6">
        <h2 id="ticket-title" className="text-2xl font-bold leading-tight">
          {event.title}
        </h2>
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

        <div className="my-5 border-t-[1.5px] border-dashed border-line" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Reference</p>
            <p className="mt-1 text-lg font-extrabold tracking-wide">{registration.reference}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Attendees</p>
            <p className="mt-1 text-lg font-extrabold">{registration.attendees}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-bg p-4 text-sm">
          <p className="font-semibold">{registration.full_name || user?.name}</p>
          <p className="mt-1 text-mute">{registration.email}</p>
          <p className="text-mute">{registration.contact}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/registrations/${registration.id}/edit`}
            className="btn btn-alt flex-1"
            onClick={onClose}
          >
            <Icon name="edit" className="h-4 w-4" />
            Edit registration
          </Link>
          <button type="button" className="btn flex-1" onClick={onClose}>
            Close ticket
          </button>
        </div>
      </div>
    </Modal>
  )
}
