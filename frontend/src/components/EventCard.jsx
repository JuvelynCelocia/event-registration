import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { formatDate, formatTimeRange } from '../lib/format'
import { isEventSaved, toggleSavedEvent } from '../lib/saved'
import { Icon } from './Icon'

export function EventMeta({ event, compact = false }) {
  return (
    <>
      <div className="meta">
        <Icon name="calendar" className="h-5 w-5 flex-none" />
        {formatDate(event.date)}
        {compact ? <span className="text-mute/70">· {formatTimeRange(event.start_time, event.end_time)}</span> : null}
      </div>
      {!compact ? (
        <div className="meta">
          <Icon name="clock" className="h-5 w-5 flex-none" />
          {formatTimeRange(event.start_time, event.end_time)}
        </div>
      ) : null}
      <div className="meta">
        <Icon name="pin" className="h-5 w-5 flex-none" />
        {event.location}
      </div>
    </>
  )
}

export function EventCard({ event, cta = 'View details', to }) {
  const [saved, setSaved] = useState(() => isEventSaved(event.id))
  const { toast } = useToast()

  function handleSave() {
    const nowSaved = toggleSavedEvent(event.id)
    setSaved(nowSaved)
    toast(nowSaved ? 'Saved to your events.' : 'Removed from saved events.', nowSaved ? 'success' : 'info')
  }

  return (
    <article className="card page-enter flex flex-col overflow-hidden">
      <div className="ph relative h-[180px]">
        <Icon name="image" className="h-12 w-12" strokeWidth={1.5} />
        {event.registration_id ? (
          <span className="badge absolute left-3 top-3 bg-card/90 shadow-sm">Registered</span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved events' : 'Save event'}
          className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/50 bg-white/80 backdrop-blur transition hover:bg-white ${
            saved ? 'text-danger' : 'text-brand-ink'
          }`}
        >
          <Icon name="heart" className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="flex-1 p-5">
        <h3 className="text-[22px] font-bold leading-tight">{event.title}</h3>
        <EventMeta event={event} />
      </div>
      <div className="px-5 pb-5">
        <Link to={to || `/events/${event.id}`} className="btn w-full">
          {cta}
        </Link>
      </div>
    </article>
  )
}

export function EventSummary({ event }) {
  return (
    <aside className="card overflow-hidden">
      <div className="ph h-[200px] md:h-[240px]">
        <Icon name="image" className="h-12 w-12" strokeWidth={1.5} />
      </div>
      <div className="p-6">
        <h2 className="text-[28px] font-bold leading-tight md:text-[32px]">{event.title}</h2>
        <EventMeta event={event} />
        {event.description ? (
          <p className="mt-4 text-[15px] leading-relaxed text-mute">{event.description}</p>
        ) : null}
        {typeof event.capacity === 'number' && typeof event.registered_count === 'number' ? (
          <p className="mt-4 text-[13px] font-medium text-mute">
            {event.registered_count} of {event.capacity} spots filled
          </p>
        ) : null}
      </div>
    </aside>
  )
}

export function EmptyState({ icon = 'calendar', title, children, action }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-dashed border-line p-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-accent">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-mute">{children}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function CardSkeleton({ className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="skeleton h-[180px] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton mt-4 h-12 w-full" />
      </div>
    </div>
  )
}
