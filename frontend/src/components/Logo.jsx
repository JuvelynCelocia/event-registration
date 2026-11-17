import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export function Logo({ to = '/', className = '' }) {
  const content = (
    <>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] border-2 border-ink">
        <Icon name="brand" className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </span>
      <span className="text-[19px] font-extrabold leading-tight md:text-[20px]">Event Registration App</span>
    </>
  )

  if (!to) {
    return <div className={`flex items-center gap-2.5 ${className}`}>{content}</div>
  }

  return (
    <Link to={to} className={`flex items-center gap-2.5 text-ink ${className}`} aria-label="Event Registration App home">
      {content}
    </Link>
  )
}

export function Avatar({ user, className = 'h-11 w-11' }) {
  return (
    <span
      className={`grid flex-none place-items-center overflow-hidden rounded-full border-2 border-ink bg-mint text-accent ${className}`}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="user" className="h-[55%] w-[55%]" />
      )}
    </span>
  )
}
