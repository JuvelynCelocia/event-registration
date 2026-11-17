import { useEffect, useState } from 'react'
import { CardSkeleton, EmptyState, EventCard } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { Recommendations } from '../components/Recommendations'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export function DashboardPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Home · Event Registration App'
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(search.trim()), 280)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ scope: 'upcoming' })
    if (query) params.set('search', query)

    api(`/events?${params.toString()}`, { signal: controller.signal })
      .then((data) => setEvents(data.events || []))
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        setError(requestError.message || 'Could not load events.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  return (
    <div className="page-enter">
      <div className="hidden md:block">
        <p className="text-[15px] font-semibold text-mute">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </p>
      </div>

      <div className="input-shell mt-4 max-w-[600px] md:mt-0">
        <Icon name="search" className="h-5 w-5 flex-none" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search events..."
          aria-label="Search events"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="rounded-lg p-1 text-mute transition hover:text-ink"
            aria-label="Clear search"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Recommendations />

      <h2 className="mb-6 mt-10 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">
        Upcoming events
      </h2>

      {error ? (
        <div className="mb-6 rounded-2xl border-[1.5px] border-danger bg-danger-bg p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : events.length ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title={query ? 'No matching events' : 'No upcoming events yet'}
          action={
            query ? (
              <button type="button" className="btn btn-alt" onClick={() => setSearch('')}>
                Clear search
              </button>
            ) : null
          }
        >
          {query
            ? `We couldn’t find an upcoming event matching “${query}”. Try a different search term.`
            : 'New events will appear here as soon as they are published. Check back soon.'}
        </EmptyState>
      )}
    </div>
  )
}
