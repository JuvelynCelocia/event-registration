import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardSkeleton, EmptyState, EventCard } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'

export function RegisterPage() {
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Register · Event Registration App'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const handle = window.setTimeout(() => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({ scope: 'upcoming' })
      if (search.trim()) params.set('search', search.trim())

      api(`/events?${params.toString()}`, { signal: controller.signal })
        .then((data) => setEvents(data.events || []))
        .catch((requestError) => {
          if (requestError.name === 'AbortError') return
          setError(requestError.message || 'Could not load events.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 280)

    return () => {
      window.clearTimeout(handle)
      controller.abort()
    }
  }, [search])

  return (
    <div className="page-enter">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="plus" className="h-5 w-5 text-accent" />
        Event registration
      </p>
      <h1 className="mt-3 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">Choose an event</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-mute">
        Pick an upcoming event to register. You can review or change your details at any time from My events.
      </p>

      <div className="input-shell mt-6 max-w-[600px]">
        <Icon name="search" className="h-5 w-5 flex-none" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search events..."
          aria-label="Search events"
        />
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border-[1.5px] border-danger bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : events.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) =>
              event.registration_id ? (
                <EventCard
                  key={event.id}
                  event={event}
                  cta="View registration"
                  to={`/events/${event.id}`}
                />
              ) : (
                <EventCard key={event.id} event={event} cta="Register now" />
              ),
            )}
          </div>
        ) : (
          <EmptyState title="Nothing to register for" icon="calendar">
            {search
              ? `No upcoming events match “${search}”. Try another search.`
              : 'There are no upcoming events right now. Check back soon.'}
          </EmptyState>
        )}
      </div>

      <div className="mt-10 rounded-2xl border-[1.5px] border-line bg-card p-5">
        <div className="flex items-start gap-3.5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint text-accent">
            <Icon name="ticket" className="h-5 w-5" />
          </span>
          <div>
            <b className="block text-[17px]">Already registered?</b>
            <p className="mt-1 text-[15px] leading-relaxed text-mute">
              Find your ticket, update attendee details, or cancel from{' '}
              <Link to="/my-events" className="font-semibold text-accent underline underline-offset-2">
                My events
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
