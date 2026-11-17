import { useEffect, useRef, useState } from 'react'
import { Alert, PasswordField, TextField } from '../components/Form'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { avatarToDataUrl } from '../lib/saved'

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const fileInput = useRef(null)

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    contact: user?.contact || '',
  })
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})
  const [profileMessage, setProfileMessage] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    document.title = 'Profile · Event Registration App'
  }, [])

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setAvatarBusy(true)
    setProfileMessage('')
    try {
      const dataUrl = await avatarToDataUrl(file)
      setAvatar(dataUrl)
      toast('Photo ready. Save changes to keep it.', 'info')
    } catch (error) {
      setProfileMessage(error.message || 'Could not use that image.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileErrors({})
    setProfileMessage('')
    try {
      const data = await api('/me', {
        method: 'PUT',
        body: { ...form, avatar },
      })
      updateUser(data.user)
      setForm({ name: data.user.name, email: data.user.email, contact: data.user.contact })
      setAvatar(data.user.avatar || '')
      toast('Your profile has been saved.')
    } catch (error) {
      setProfileErrors(error.errors || {})
      setProfileMessage(error.message || 'Could not save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setSavingPassword(true)
    setPasswordErrors({})
    setPasswordMessage('')
    try {
      await api('/me/password', { method: 'PUT', body: passwords })
      setPasswords({ current_password: '', new_password: '' })
      toast('Your password has been updated.')
    } catch (error) {
      setPasswordErrors(error.errors || {})
      setPasswordMessage(error.message || 'Could not update your password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="page-enter">
      <h1 className="mb-7 text-[32px] font-bold tracking-[-0.01em] md:text-[40px]">Profile</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr]">
        <section className="card p-6 text-center md:p-8">
          <div className="mx-auto mb-4 grid h-[140px] w-[140px] place-items-center overflow-hidden rounded-full border-[1.5px] border-line bg-mint text-accent">
            {avatar ? (
              <img src={avatar} alt={`${form.name} profile`} className="h-full w-full object-cover" />
            ) : (
              <Icon name="user" className="h-16 w-16" strokeWidth={1.5} />
            )}
          </div>
          <h2 className="text-[24px] font-bold leading-tight">{form.name || user?.name}</h2>
          <p className="mb-5 mt-1 break-words text-mute">{form.email || user?.email}</p>
          {user?.role === 'admin' ? <span className="badge mb-4">Administrator</span> : null}

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={choosePhoto}
            aria-label="Choose profile photo"
          />
          <button
            type="button"
            className="btn btn-alt w-full"
            onClick={() => fileInput.current?.click()}
            disabled={avatarBusy}
          >
            <Icon name="camera" className="h-5 w-5" />
            {avatarBusy ? 'Preparing photo…' : 'Change photo'}
          </button>
          {avatar ? (
            <button
              type="button"
              onClick={() => {
                setAvatar('')
                setProfileMessage('')
              }}
              className="mt-3 text-sm font-semibold text-mute underline underline-offset-2 transition hover:text-danger"
            >
              Remove photo
            </button>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-mute">
            Square images work best. Photos are resized automatically before saving.
          </p>
        </section>

        <div className="grid gap-6">
          <section className="card p-6 md:p-8">
            <h2 className="mb-5 text-[24px] font-bold md:text-[26px]">Personal information</h2>
            <form onSubmit={saveProfile} noValidate>
              {profileMessage ? (
                <Alert tone="danger" className="mb-5" title="Could not save">
                  {profileMessage}
                </Alert>
              ) : null}
              <TextField
                id="profile-name"
                label="Full name"
                icon="user"
                autoComplete="name"
                value={form.name}
                error={profileErrors.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <TextField
                id="profile-email"
                label="Email address"
                icon="mail"
                type="email"
                autoComplete="email"
                value={form.email}
                error={profileErrors.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
              <TextField
                id="profile-contact"
                label="Contact number"
                icon="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+63 900 000 0000"
                value={form.contact}
                error={profileErrors.contact}
                onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))}
              />
              <button type="submit" className="btn" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <section className="card p-6 md:p-8">
            <h2 className="mb-5 text-[24px] font-bold md:text-[26px]">Change password</h2>
            <form onSubmit={savePassword} noValidate>
              {passwordMessage ? (
                <Alert tone="danger" className="mb-5" title="Could not update password">
                  {passwordMessage}
                </Alert>
              ) : null}
              <PasswordField
                id="password-current"
                label="Current password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={passwords.current_password}
                error={passwordErrors.current_password}
                onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))}
                required
              />
              <PasswordField
                id="password-new"
                label="New password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={passwords.new_password}
                error={passwordErrors.new_password}
                hint="Use at least 6 characters."
                onChange={(event) => setPasswords((current) => ({ ...current, new_password: event.target.value }))}
                required
              />
              <button type="submit" className="btn btn-alt" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
