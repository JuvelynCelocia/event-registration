import { useState } from 'react'
import { Icon } from './Icon'

export function Field({ label, htmlFor, error, hint, className = '', children }) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-mute">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField({ label, id, icon, error, hint, className = '', ...props }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <div className={`input-shell ${error ? 'is-bad' : ''}`}>
        {icon ? <Icon name={icon} className="h-5 w-5 flex-none" /> : null}
        <input id={id} {...props} />
      </div>
    </Field>
  )
}

export function PasswordField({ label, id, error, hint, className = '', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <div className={`input-shell ${error ? 'is-bad' : ''}`}>
        <Icon name="lock" className="h-5 w-5 flex-none" />
        <input id={id} type={visible ? 'text' : 'password'} {...props} />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="rounded-lg p-1 text-mute transition hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} className="h-5 w-5" />
        </button>
      </div>
    </Field>
  )
}

export function TextAreaField({ label, id, error, hint, className = '', ...props }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <div
        className={`rounded-xl border-[1.5px] bg-card p-4 transition focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15 ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        <textarea
          id={id}
          className="min-h-[92px] w-full resize-y border-0 bg-transparent text-base text-ink outline-none"
          {...props}
        />
      </div>
    </Field>
  )
}

export function SelectField({ label, id, error, hint, className = '', children, ...props }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <div className={`input-shell ${error ? 'is-bad' : ''}`}>
        <select id={id} {...props}>
          {children}
        </select>
        <Icon name="chevron-right" className="h-4 w-4 rotate-90 flex-none text-mute" />
      </div>
    </Field>
  )
}

export function Alert({ tone = 'info', title, children, className = '' }) {
  const styles = {
    success: 'border-accent bg-mint text-accent',
    danger: 'border-danger bg-danger-bg text-danger',
    info: 'border-line bg-card text-mute',
  }
  const icons = { success: 'check', danger: 'info', info: 'info' }

  return (
    <div className={`flex items-start gap-3.5 rounded-2xl border-[1.5px] p-4 ${styles[tone]} ${className}`}>
      <Icon name={icons[tone]} className="mt-0.5 h-6 w-6 flex-none" />
      <div className="min-w-0">
        {title ? <b className="block text-[17px] text-current">{title}</b> : null}
        <div className="text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
