import type { SafeHttpsUrl } from './authored-destination-contract'

type ExternalUrlMediaKind = 'audio' | 'file' | 'image' | 'pdf' | 'video'

const MEDIA_EXTENSIONS = {
  audio: new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav']),
  image: new Set(['apng', 'avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']),
  video: new Set(['m4v', 'mov', 'mp4', 'ogv', 'webm']),
} as const

export function presentExternalUrl(url: SafeHttpsUrl): Readonly<{
  href: SafeHttpsUrl
  mediaKind: ExternalUrlMediaKind
  title: string
}> {
  try {
    const parsed = new URL(url)
    const encodedName = parsed.pathname.split('/').filter(Boolean).at(-1)
    const title = encodedName ? decodeUrlComponent(encodedName) : parsed.hostname
    return {
      href: url,
      mediaKind: externalUrlMediaKind(title),
      title,
    }
  } catch {
    return { href: url, mediaKind: 'file', title: url }
  }
}

function decodeUrlComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function externalUrlMediaKind(title: string): ExternalUrlMediaKind {
  const extension = title.split('.').at(-1)?.toLowerCase()
  if (!extension || extension === title.toLowerCase()) return 'file'
  if (MEDIA_EXTENSIONS.image.has(extension)) return 'image'
  if (MEDIA_EXTENSIONS.audio.has(extension)) return 'audio'
  if (MEDIA_EXTENSIONS.video.has(extension)) return 'video'
  return extension === 'pdf' ? 'pdf' : 'file'
}
