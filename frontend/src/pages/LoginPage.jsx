import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, PasswordField, TextField } from '../components/Form'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const demoAccounts = [
  { label: 'Student demo', email: 'alex.santos@email.com', password: 'Password123' },
  { label: 'Admin demo', email: 'admin@eventapp.test', password: 'Admin123' },
]

const emptySignup = { name: '', email: '', password: '' }

export function LoginPage() {
  const { user, booting, login, register } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'

  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ email: '', password: '' })
  const [signup, setSignup] = useState(emptySignup)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Log in · Event Registration App'
  }, [])

  if (!booting && user) {
    return <Navigate to={redirectTo} replace />
  }

  function switchMode(next) {
    setMode(next)
    setErrors({})
    setMessage('')
  }

  async function submitLogin(event, credentials = values) {
    event?.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const signedIn = await login(credentials.email, credentials.password)
      toast(`Welcome back, ${signedIn.name.split(' ')[0]}.`)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setErrors(error.errors || {})
      setMessage(error.message || 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSignup(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const created = await register(signup)
      toast(`Account created. Welcome, ${created.name.split(' ')[0]}.`)
      navigate('/', { replace: true })
    } catch (error) {
      setErrors(error.errors || {})
      setMessage(error.message || 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand p-8 text-brand-ink md:p-14 lg:p-16">
        <Icon
          name="sparkle"
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-20"
          strokeWidth={1}
        />
        <div className="relative flex flex-col gap-6">
          <span className="grid h-20 w-20 place-items-center rounded-[20px] border-[3px] border-brand-ink lg:h-24 lg:w-24">
            <Icon name="brand" className="h-10 w-10 lg:h-12 lg:w-12" strokeWidth={1.6} />
          </span>
          <h1 className="max-w-[12ch] text-[40px] font-extrabold leading-[0.95] tracking-[-0.02em] md:text-[56px] lg:text-[68px] xl:text-[72px]">
            Event Registration App
          </h1>
          <p className="max-w-[28ch] text-lg font-medium md:text-[22px]">
            Find, join, and be part of amazing events!
          </p>
        </div>
        <p className="relative hidden text-sm font-medium text-brand-ink/70 lg:block">
          © {new Date().getFullYear()} Event Registration App
        </p>
      </section>

      <section className="flex items-center justify-center bg-bg px-5 py-10 md:px-10">
        <div className="w-full max-w-[420px] page-enter">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink">
              <Icon name="brand" className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-lg font-extrabold leading-tight">Event Registration App</span>
          </div>

          {mode === 'login' ? (
            <>
              <h2 className="mb-6 text-[32px] font-bold tracking-[-0.01em] md:text-[34px]">Log in</h2>
              <form onSubmit={submitLogin} noValidate>
                {message ? (
                  <Alert tone="danger" className="mb-5" title="Could not log in">
                    {message}
                  </Alert>
                ) : null}
                <TextField
                  id="login-email"
                  label="Email address"
                  icon="mail"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={values.email}
                  error={errors.email}
                  onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                  required
                />
                <PasswordField
                  id="login-password"
                  label="Password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={values.password}
                  error={errors.password}
                  onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
                  required
                />
                <button type="submit" className="btn mt-2 w-full" disabled={busy}>
                  {busy ? 'Logging in…' : 'Log in'}
                </button>
              </form>

              <p className="my-5 text-center text-mute">or</p>
              <button type="button" className="btn btn-alt w-full" onClick={() => switchMode('signup')}>
                <Icon name="user" className="h-5 w-5" />
                Create new account
              </button>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="mx-auto mt-5 block text-center font-semibold text-accent underline underline-offset-2 transition hover:text-ink"
              >
                Forgot password?
              </button>

              <div className="mt-10 rounded-2xl border-[1.5px] border-dashed border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Try a demo account</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={busy}
                      onClick={(event) => {
                        setValues({ email: account.email, password: account.password })
                        submitLogin(event, account)
                      }}
                      className="rounded-lg border-[1.5px] border-line bg-card px-3 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      {account.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-mute">
                  Student: alex.santos@email.com · Admin: admin@eventapp.test
                </p>
              </div>
            </>
          ) : null}

          {mode === 'signup' ? (
            <>
              <h2 className="mb-2 text-[32px] font-bold tracking-[-0.01em] md:text-[34px]">Create account</h2>
              <p className="mb-6 text-[15px] text-mute">It only takes a moment to start joining events.</p>
              <form onSubmit={submitSignup} noValidate>
                {message ? (
                  <Alert tone="danger" className="mb-5" title="Could not create account">
                    {message}
                  </Alert>
                ) : null}
                <TextField
                  id="signup-name"
                  label="Full name"
                  icon="user"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={signup.name}
                  error={errors.name}
                  onChange={(event) => setSignup((current) => ({ ...current, name: event.target.value }))}
                  required
                />
                <TextField
                  id="signup-email"
                  label="Email address"
                  icon="mail"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={signup.email}
                  error={errors.email}
                  onChange={(event) => setSignup((current) => ({ ...current, email: event.target.value }))}
                  required
                />
                <PasswordField
                  id="signup-password"
                  label="Password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={signup.password}
                  error={errors.password}
                  hint="Use at least 6 characters."
                  onChange={(event) => setSignup((current) => ({ ...current, password: event.target.value }))}
                  required
                />
                <button type="submit" className="btn mt-2 w-full" disabled={busy}>
                  {busy ? 'Creating account…' : 'Create account'}
                </button>
              </form>
              <p className="mt-5 text-center text-[15px] text-mute">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} className="font-semibold text-accent underline underline-offset-2">
                  Log in
                </button>
              </p>
            </>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <h2 className="mb-2 text-[32px] font-bold tracking-[-0.01em] md:text-[34px]">Reset password</h2>
              <p className="mb-6 text-[15px] text-mute">
                Enter your email address and we’ll help you get back into your account.
              </p>
              <Alert tone="info" title="Demo environment">
                Password resets are not sent in this demo. Use one of the demo accounts on the log in screen, or
                ask an administrator to reset your password.
              </Alert>
              <div className="mt-6 flex flex-col gap-3">
                <button type="button" className="btn" onClick={() => switchMode('login')}>
                  Back to log in
                </button>
                <button type="button" className="btn btn-alt" onClick={() => switchMode('signup')}>
                  Create a new account
                </button>
              </div>
            </>
          ) : null}

          <p className="mt-10 text-center text-xs text-mute">
            <Link to="/" className="hover:text-ink">
              Event Registration App
            </Link>{' '}
            · Built for campus communities
          </p>
        </div>
      </section>
    </div>
  )
}
