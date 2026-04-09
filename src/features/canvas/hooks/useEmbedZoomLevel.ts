import { useStore } from '@xyflow/react'

const EMBED_ZOOM_THRESHOLD = 0.9

const selectIsRichView = (s: { transform: [number, number, number] }) =>
  s.transform[2] >= EMBED_ZOOM_THRESHOLD

export function useIsEmbedRichView() {
  return useStore(selectIsRichView)
}
