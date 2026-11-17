import { Outlet } from 'react-router-dom'
import { AiAssistant } from './AiAssistant'
import { Header, MobileTabs } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg border-[1.5px] border-line bg-card px-4 py-2 font-semibold text-ink shadow-lg focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-page px-5 pb-28 pt-8 outline-none md:px-8 md:pt-10 md:pb-16"
      >
        <Outlet />
      </main>
      <MobileTabs />
      <AiAssistant />
    </div>
  )
}
