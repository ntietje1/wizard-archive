import type { ResourceId } from '../../resources/domain-id'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'

export function useMapImageStatus(mapId: ResourceId, imageUrl: string | null) {
  const mapImageKey = imageUrl ? `${mapId}:${imageUrl}` : null
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null)
  const [erroredImageKey, setErroredImageKey] = useState<string | null>(null)
  const imageLoaded = mapImageKey !== null && loadedImageKey === mapImageKey
  const imageError = mapImageKey !== null && erroredImageKey === mapImageKey

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!mapImageKey || !isActiveImageEvent(event, imageUrl)) return
    setLoadedImageKey(mapImageKey)
    setErroredImageKey((current) => (current === mapImageKey ? null : current))
  }

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!mapImageKey || !isActiveImageEvent(event, imageUrl)) return
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

function isActiveImageEvent(event: SyntheticEvent<HTMLImageElement>, imageUrl: string | null) {
  if (!imageUrl) return false
  const image = event.currentTarget
  return (
    image.getAttribute('src') === imageUrl ||
    image.currentSrc === imageUrl ||
    image.src === imageUrl
  )
}
