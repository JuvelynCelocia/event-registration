
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getSavedEventIds } from '../lib/saved'
import { Icon } from './Icon'
import { Modal } from './Modal'

const QUICK_PROMPTS = [
  "What's coming up next?",
  'Where are my events?',
  'Show my registrations',
]

function greetingFor(user) {
  const firstName = user?.name?.split(' ')[0] || 'there'

  return `Hi ${firstName}! I can help with upcoming events, venues, schedules, and your registrations. What would you like to know?`
}

export function AiAssistant() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => [
    { role: 'assistant', content: greetingFor(user) },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')
  const logRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const element = logRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, sending, open])

  useEffect(() => {
    if (!open) return undefined
    const handle = window.setTimeout(() => inputRef.current?.focus(), 60)

    return () => window.clearTimeout(handle)
  }, [open])

  async function send(raw) {
    const message = raw.trim()
    if (!message || sending) return

    const history = messages.slice(-8).map(({ role, content }) => ({
      role,
      content,
    }))

    setMessages((current) => [
      ...current,
      { role: 'user', content: message },
    ])
    setInput('')
    setError('')
    setSending(true)

    try {
      const data = await api('/ai/assistant', {
        method: 'POST',
        body: {
          message,
          history,
          saved_event_ids: getSavedEventIds(),
        },
      })

      if (!data || typeof data !== 'object') {
        throw new Error(
          'The server returned an empty or invalid response. Please check the PHP API.'
        )
      }

      const reply =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply
          : 'I could not find an answer for that.'

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: reply },
      ])

      setMode(data.mode || '')
    } catch (requestError) {
      setError(
        requestError.message ||
          'The assistant is unavailable right now. Please try again.'
      )
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    send(input)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(input)
    }
  }

  return (
    <>
      <div className="fixed bottom-[84px] right-4 z-40 md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-brand px-4 py-3.5 font-semibold text-brand-ink shadow-xl transition hover:brightness-95"
          aria-haspopup="dialog"
        >
          <Icon name="sparkle" className="h-5 w-5" />
          <span className="hidden sm:inline">Ask AI</span>
          <span className="sr-only sm:hidden">Open AI event assistant</span>
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="ai-title"
        className="max-w-[460px]"
      >
        <div className="flex max-h-[min(660px,calc(100vh-2rem))] flex-col">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint text-accent">
              <Icon name="sparkle" className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 id="ai-title" className="text-base font-bold">
                Event assistant
              </h2>
              <p className="text-[13px] text-mute">
                Ask about events, venues, or your tickets.
              </p>
            </div>

            {mode ? (
              <span
                className="badge flex-none"
                title={
                  mode === 'ai'
                    ? 'Answered by the AI provider'
                    : 'Answered from app data'
                }
              >
                {mode === 'ai' ? 'AI' : 'Rules'}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="grid h-9 w-9 flex-none place-items-center rounded-lg text-mute transition hover:bg-mint hover:text-ink"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-brand text-brand-ink'
                      : 'rounded-bl-md bg-mint text-ink'
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {sending ? (
              <div
                className="flex justify-start"
                aria-label="Assistant is typing"
              >
                <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-mint px-4 py-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                </span>
              </div>
            ) : null}

            {messages.length === 1 && !sending ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-semibold text-mute transition hover:border-accent/60 hover:text-ink"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border-[1.5px] border-danger bg-danger-bg p-3 text-[13px] text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <label className="input-shell !h-auto min-h-[46px] flex-1 py-2">
              <span className="sr-only">Message the event assistant</span>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                maxLength={1000}
                className="max-h-28 resize-none leading-relaxed"
              />
            </label>

            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="btn h-[46px] w-[46px] flex-none !px-0"
            >
              <Icon name="send" className="h-5 w-5" />
            </button>
          </form>
        </div>
      </Modal>
    </>
  )
}
