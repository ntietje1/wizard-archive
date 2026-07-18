import { useEffect, useState } from 'react'
import type { ContentExportResult, MapImageAttachment } from '../resources/content-session-contract'
import { beginContentObjectUrlLoad } from '../resources/content-object-url'
import type { ContentObjectUrlState } from '../resources/content-object-url'

type MapImageState = Readonly<{ status: 'empty' }> | ContentObjectUrlState

export function useMapImageUrl(
  source: Readonly<{
    loadImage(layerId: string | null): Promise<ContentExportResult>
  }>,
  layerId: string | null,
  image: MapImageAttachment,
) {
  const [attempt, setAttempt] = useState(0)
  const attachmentKey = image.status === 'attached' ? image.digest : image.status
  const requestKey = `${attachmentKey}:${attempt}`
  const initialState: MapImageState =
    image.status === 'unattached' ? { status: 'empty' } : { status: 'loading' }
  const [loaded, setLoaded] = useState<{ key: string; state: MapImageState }>(() => ({
    key: requestKey,
    state: initialState,
  }))
  const state = loaded.key === requestKey ? loaded.state : initialState

  useEffect(() => {
    if (image.status === 'unattached') return
    return beginContentObjectUrlLoad(
      () => source.loadImage(layerId),
      (nextState) => setLoaded({ key: requestKey, state: nextState }),
    )
  }, [image.status, layerId, requestKey, source])

  return { retry: () => setAttempt((current) => current + 1), state }
}
