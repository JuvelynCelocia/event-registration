const STORAGE_KEY = 'era.saved'

export function getSavedEventIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : []
  } catch {
    return []
  }
}

export function isEventSaved(eventId) {
  return getSavedEventIds().includes(Number(eventId))
}

export function toggleSavedEvent(eventId) {
  const id = Number(eventId)
  const current = getSavedEventIds()
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore unavailable storage */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('era:saved-changed', { detail: next }))
  }
  return next.includes(id)
}

const AVATAR_STORAGE_KEY = 'era.avatar'
let memoryAvatar = ''

export function getCachedAvatar() {
  try {
    return localStorage.getItem(AVATAR_STORAGE_KEY) || memoryAvatar
  } catch {
    return memoryAvatar
  }
}

export function cacheAvatar(dataUrl) {
  memoryAvatar = dataUrl || ''
  try {
    if (dataUrl) {
      localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl)
    } else {
      localStorage.removeItem(AVATAR_STORAGE_KEY)
    }
  } catch {
    /* ignore unavailable storage */
  }
}

export async function avatarToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error('That image is larger than 6 MB.')
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('That image could not be opened.'))
    element.src = dataUrl
  })

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const shortest = Math.min(image.width, image.height)
  const sourceX = (image.width - shortest) / 2
  const sourceY = (image.height - shortest) / 2
  context.drawImage(image, sourceX, sourceY, shortest, shortest, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.86)
}
