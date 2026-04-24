import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'

export function useMapImageStatus(mapId: Id<'sidebarItems'>, imageUrl: string | null) {
  const mapImageKey = imageUrl ? `${mapId}:${imageUrl}` : null
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null)
  const [erroredImageKey, setErroredImageKey] = useState<string | null>(null)
  const imageLoaded = mapImageKey !== null && loadedImageKey === mapImageKey
  const imageError = mapImageKey !== null && erroredImageKey === mapImageKey

  const handleImageLoad = () => {
    if (!mapImageKey) return
    setLoadedImageKey(mapImageKey)
    setErroredImageKey((current) => (current === mapImageKey ? null : current))
  }

  const handleImageError = () => {
    if (!mapImageKey) return
    setErroredImageKey(mapImageKey)
    setLoadedImageKey((current) => (current === mapImageKey ? null : current))
  }

  return {
    imageLoaded,
    imageError,
    handleImageLoad,
    handleImageError,
  }
}
