import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore, USER_KEY } from '../lib/api'
import { cacheAvatar, getCachedAvatar } from '../lib/saved'

const AuthContext = createContext(null)

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCachedUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    /* ignore unavailable storage */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = readCachedUser()
    return cached ? { ...cached, avatar: cached.avatar || getCachedAvatar() } : null
  })
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let active = true
    const token = tokenStore.get()

    if (!token) {
      setBooting(false)
      return () => {
        active = false
      }
    }

    api('/auth/me', { token })
      .then(({ user: fresh }) => {
        if (!active) return
        const next = { ...fresh, avatar: fresh.avatar || getCachedAvatar() }
        setUser(next)
        writeCachedUser(next)
        cacheAvatar(next.avatar)
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          tokenStore.clear()
          setUser(null)
          writeCachedUser(null)
        }
      })
      .finally(() => {
        if (active) setBooting(false)
      })

    return () => {
      active = false
    }
  }, [])

  const remember = useCallback((nextUser) => {
    setUser(nextUser)
    writeCachedUser(nextUser)
    cacheAvatar(nextUser?.avatar || '')
  }, [])

  const login = useCallback(
    async (email, password) => {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
        token: null,
      })
      tokenStore.set(data.token)
      remember(data.user)
      return data.user
    },
    [remember],
  )

  const register = useCallback(
    async (payload) => {
      const data = await api('/auth/register', {
        method: 'POST',
        body: payload,
        token: null,
      })
      tokenStore.set(data.token)
      remember(data.user)
      return data.user
    },
    [remember],
  )

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      /* the local session is cleared regardless */
    }
    tokenStore.clear()
    setUser(null)
    writeCachedUser(null)
  }, [])

  const updateUser = useCallback(
    (nextUser) => {
      remember(nextUser)
    },
    [remember],
  )

  const value = useMemo(
    () => ({ user, booting, login, register, logout, updateUser }),
    [user, booting, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
