import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, formatTimeRange } from '../lib/format'
import { getSavedEventIds, toggleSavedEvent } from '../lib/saved'

const NOTIFICATIONS_KEY = 'era.notifications'
const DEFAULT_NOTIFICATIONS = {
  reminders: true,
  updates: true,
  announcements: false,
}

function readNotifications() {
  try {
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '{}') }
  } catch {
    return DEFAULT_NOTIFICATIONS
  }
}

function MenuRow({ icon, title, subtitle, to, onClick, right }) {
  const content = (
    <>
      <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-mint text-accent">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[17px] md:text-[18px]">{title}</b>
        <span className="block text-sm text-mute md:text-[15px]">{subtitle}</span>
      </span>
      {right || <Icon name="chevron-right" className="h-5 w-5 flex-none text-mute" />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="menu-row">
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className="menu-row">
      {content}
    </button>
  )
}

function SettingsModal({ open, onClose, title, description, children, icon = 'bell' }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-mint text-accent">
            <Icon name={icon} className="h-6 w-6" />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-mute transition hover:bg-line/40 hover:text-ink"
            aria-label="Close"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <h2 id="settings-title" className="mt-4 text-2xl font-bold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[15px] leading-relaxed text-mute">{description}</p> : null}
        <div className="mt-5">{children}</div>
      </div>
    </Modal>
  )
}

export function MorePage() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [notifications, setNotifications] = useState(readNotifications)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedEvents, setSavedEvents] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    document.title = 'More · Event Registration App'
  }, [])

  useEffect(() => {
    if (!savedOpen) return undefined
    const controller = new AbortController()
    setSavedLoading(true)
    const ids = getSavedEventIds()

    api('/events', { signal: controller.signal })
      .then((data) => {
        const matches = (data.events || []).filter((event) => ids.includes(Number(event.id)))
        setSavedEvents(matches)
      })
      .catch(() => setSavedEvents([]))
      .finally(() => {
        if (!controller.signal.aborted) setSavedLoading(false)
      })

    return () => controller.abort()
  }, [savedOpen])

  function applyTheme(nextDark) {
    setDark(nextDark)
    document.documentElement.classList.toggle('dark', nextDark)
    try {
      localStorage.setItem('era.theme', nextDark ? 'dark' : 'light')
    } catch {
      /* ignore unavailable storage */
    }
  }

  function toggleNotification(key) {
    const next = { ...notifications, [key]: !notifications[key] }
    setNotifications(next)
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next))
    } catch {
      /* ignore unavailable storage */
    }
  }

  function removeSaved(eventId) {
    toggleSavedEvent(eventId)
    setSavedEvents((current) => current.filter((event) => Number(event.id) !== Number(eventId)))
    toast('Removed from saved events.', 'info')
  }

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    toast('You have been signed out.', 'info')
    navigate('/login', { replace: true })
  }

  const notificationRows = [
    { key: 'reminders', title: 'Event reminders', description: 'Get a nudge the day before an event you joined.' },
    { key: 'updates', title: 'Registration updates', description: 'Changes to your tickets and attendee details.' },
    { key: 'announcements', title: 'New events', description: 'Hear about newly published events on campus.' },
  ]

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">More</h1>
        <p className="text-sm text-mute">
          Signed in as <b className="text-ink">{user?.name}</b>
          {user?.role === 'admin' ? ' · Administrator' : ''}
        </p>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <MenuRow icon="user" title="Profile" subtitle="Your name, email and contact details" to="/profile" />
        <MenuRow
          icon="bell"
          title="Notifications"
          subtitle="Event reminders and updates"
          onClick={() => setNotificationsOpen(true)}
        />
        <MenuRow
          icon="heart"
          title="Saved events"
          subtitle="Events you bookmarked"
          onClick={() => setSavedOpen(true)}
        />
        <div className="menu-row cursor-default">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-mint text-accent">
            <Icon name={dark ? 'moon' : 'sun'} className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[17px] md:text-[18px]">Appearance</b>
            <span className="block text-sm text-mute md:text-[15px]">Switch between light and dark</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label="Dark mode"
            onClick={() => applyTheme(!dark)}
            className={`switch ${dark ? 'on' : ''}`}
          />
        </div>
        <MenuRow
          icon="calendar"
          title="Manage events"
          subtitle={user?.role === 'admin' ? 'Add, edit or delete events' : 'Administrator tools'}
          to="/manage-events"
        />
        <MenuRow icon="help" title="Help & support" subtitle="FAQs and contact us" onClick={() => setHelpOpen(true)} />
        <MenuRow icon="info" title="About" subtitle="Version and terms" onClick={() => setAboutOpen(true)} />
      </div>

      <button
        type="button"
        className="btn btn-alt mt-7 text-danger"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        <Icon name="logout" className="h-5 w-5" />
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>

      <SettingsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Notifications"
        description="Choose how the app keeps you in the loop. Saved on this device."
      >
        <div className="divide-y divide-line rounded-xl border-[1.5px] border-line">
          {notificationRows.map((row) => (
            <div key={row.key} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-mute">{row.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifications[row.key]}
                aria-label={row.title}
                onClick={() => toggleNotification(row.key)}
                className={`switch ${notifications[row.key] ? 'on' : ''}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn w-full sm:w-auto" onClick={() => setNotificationsOpen(false)}>
            Done
          </button>
        </div>
      </SettingsModal>

      <SettingsModal
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        title="Saved events"
        description="Events you bookmarked with the heart button."
        icon="heart"
      >
        {savedLoading ? (
          <p className="py-6 text-center text-sm text-mute">Loading saved events…</p>
        ) : savedEvents.length ? (
          <div className="grid gap-3">
            {savedEvents.map((event) => (
              <div key={event.id} className="rounded-xl border-[1.5px] border-line p-4">
                <p className="font-semibold leading-tight">{event.title}</p>
                <div className="meta mt-1.5">
                  <Icon name="calendar" className="h-4 w-4 flex-none" />
                  {formatDate(event.date)}
                  <span className="text-mute/70">· {formatTimeRange(event.start_time, event.end_time)}</span>
                </div>
                <div className="meta">
                  <Icon name="pin" className="h-4 w-4 flex-none" />
                  {event.location}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/events/${event.id}`}
                    className="btn btn-sm flex-1"
                    onClick={() => setSavedOpen(false)}
                  >
                    View event
                  </Link>
                  <button
                    type="button"
                    className="btn btn-alt btn-sm"
                    onClick={() => removeSaved(event.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-center">
            <Icon name="heart" className="mx-auto h-6 w-6 text-mute" />
            <p className="mt-2 text-sm leading-relaxed text-mute">
              Nothing saved yet. Tap the heart on an event card to keep it here.
            </p>
            <Link to="/" className="btn btn-alt btn-sm mt-4" onClick={() => setSavedOpen(false)}>
              Browse events
            </Link>
          </div>
        )}
      </SettingsModal>

      <SettingsModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Help & support"
        description="Quick answers for common questions."
        icon="help"
      >
        <div className="grid gap-3">
          {[
            {
              question: 'How do I register for an event?',
              answer: 'Open Register, choose an event, fill in your details and submit. You can view your ticket right away.',
            },
            {
              question: 'Can I change my attendee details?',
              answer: 'Yes. Go to My events, open your ticket and choose Edit registration.',
            },
            {
              question: 'What happens if I cancel?',
              answer: 'Your spot is released for someone else. You can register again later if spots remain.',
            },
          ].map((item) => (
            <details key={item.question} className="rounded-xl border-[1.5px] border-line p-4">
              <summary className="cursor-pointer font-semibold">{item.question}</summary>
              <p className="mt-2 text-sm leading-relaxed text-mute">{item.answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-bg p-4 text-sm leading-relaxed">
          Still need a hand? Email{' '}
          <a className="font-semibold text-accent underline underline-offset-2" href="mailto:support@eventapp.test">
            support@eventapp.test
          </a>{' '}
          and our team will get back to you.
        </div>
      </SettingsModal>

      <SettingsModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="About this app"
        description="Event Registration App · Version 1.0.0"
        icon="info"
      >
        <div className="rounded-xl bg-bg p-4 text-sm leading-relaxed text-mute">
          <p>
            The Event Registration App helps campus communities discover events, register attendees, and manage
            tickets in one place.
          </p>
          <p className="mt-3">
            This demo stores data in a local SQLite database served by a PHP API. Accounts, registrations and
            events are for demonstration only.
          </p>
          <p className="mt-3">
            By using the app you agree to keep your account details accurate and to treat other attendees with
            respect.
          </p>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn w-full sm:w-auto" onClick={() => setAboutOpen(false)}>
            Close
          </button>
        </div>
      </SettingsModal>
    </div>
  )
}
