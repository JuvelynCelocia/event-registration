import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found · Event Registration App'
  }, [])

  return (
    <div className="grid min-h-[55vh] place-items-center text-center page-enter">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-accent">
          <Icon name="search" className="h-8 w-8" />
        </span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-mute">Error 404</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mute">
          The page you were looking for may have moved, or the link might be out of date.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn">
            <Icon name="home" className="h-5 w-5" />
            Go home
          </Link>
          <Link to="/my-events" className="btn btn-alt">
            My events
          </Link>
        </div>
      </div>
    </div>
  )
}
