import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icon'
import { Avatar, Logo } from './Logo'

const navItems = [
  { to: '/', label: 'Home', icon: 'home', match: (path) => path === '/' },
  {
    to: '/my-events',
    label: 'My Events',
    icon: 'calendar',
    match: (path) => path.startsWith('/my-events') || path.startsWith('/registrations'),
  },
  {
    to: '/register',
    label: 'Register',
    icon: 'plus',
    match: (path) => path === '/register' || path.startsWith('/events/'),
  },
  {
    to: '/more',
    label: 'More',
    icon: 'more',
    match: (path) =>
      path.startsWith('/more') || path.startsWith('/profile') || path.startsWith('/manage-events'),
  },
]

export function Header() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="flex items-center gap-3 px-5 py-3 md:gap-5 md:px-10 xl:px-16">
        <Logo />
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-4 py-2 font-semibold transition ${
                  active ? 'nav-on' : 'text-mute hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Link
          to="/more"
          aria-label="Open profile menu"
          className="ml-auto rounded-full md:ml-0"
        >
          <Avatar user={user} />
        </Link>
      </div>
    </header>
  )
}

export function MobileTabs() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card px-1.5 pt-1.5 md:hidden"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-xs transition ${
              active ? 'font-semibold text-accent' : 'text-mute'
            }`}
          >
            <Icon name={item.icon} className="h-6 w-6" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
