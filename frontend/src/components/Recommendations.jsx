import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { getSavedEventIds } from '../lib/saved'
import { Icon } from './Icon'

export function Recommendations() {
  const [items, setItems] = useState([])
  const [mode, setMode] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const handleSavedChange = () => setVersion((current) => current + 1)
    window.addEventListener('era:saved-changed', handleSavedChange)

    return () => window.removeEventListener('era:saved-changed', handleSavedChange)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const saved = getSavedEventIds()
    const params = new URLSearchParams()
    if (saved.length) params.set('saved', saved.join(','))

    api(`/ai/recommendations${params.toString() ? `?${params.toString()}` : ''}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : [])
        setMode(data.mode || '')
      })
      .catch(() => {
        /* Recommendations are optional — hide the section when unavailable. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [version])

  if (loading) {
    return (
      <section className="mt-8" aria-hidden="true">
        <div className="flex items-center gap-2">
          <span className="skeleton h-8 w-8 rounded-lg" />
          <span className="skeleton h-6 w-48" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <span className="skeleton h-[132px]" />
          <span className="skeleton hidden h-[132px] sm:block" />
          <span className="skeleton hidden h-[132px] xl:block" />
        </div>
      </section>
    )
  }

  if (!items.length) return null

  return (
    <section className="mt-8" aria-labelledby="recommendations-title">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-mint text-accent">
          <Icon name="sparkle" className="h-4 w-4" />
        </span>
        <h2 id="recommendations-title" className="text-xl font-bold">
          Recommended for you
        </h2>
        <span className="badge ml-auto" title={mode === 'ai' ? 'Ranked by the AI provider' : 'Ranked from your activity'}>
          {mode === 'ai' ? 'AI picks' : 'Smart picks'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ event, reason }) => (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="card group flex flex-col p-5 transition hover:border-accent/60"
          >
            <p className="text-[13px] font-semibold text-accent">{reason}</p>
            <h3 className="mt-2 text-lg font-bold leading-tight">{event.title}</h3>
            <div className="meta mt-3">
              <Icon name="calendar" className="h-4 w-4 flex-none" />
              {formatDate(event.date)}
            </div>
            <div className="meta">
              <Icon name="pin" className="h-4 w-4 flex-none" />
              {event.location}
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
              View event
              <Icon name="chevron-right" className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
