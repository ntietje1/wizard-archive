import { create } from 'zustand'

interface EraseToolLocalOverlayState {
  erasingStrokeIds: Set<string>
}

interface EraseToolLocalOverlayActions {
  setErasingStrokeIds: (ids: Set<string>) => void
  reset: () => void
}

const EMPTY_ERASING_STROKE_IDS = new Set<string>()

export const useEraseToolLocalOverlayStore = create<
  EraseToolLocalOverlayState & EraseToolLocalOverlayActions
>((set) => ({
  erasingStrokeIds: EMPTY_ERASING_STROKE_IDS,
  setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
  reset: () => set({ erasingStrokeIds: EMPTY_ERASING_STROKE_IDS }),
}))

export function setEraseToolErasingStrokeIds(ids: Set<string>) {
  useEraseToolLocalOverlayStore.getState().setErasingStrokeIds(ids)
}

export function clearEraseToolLocalOverlay() {
  useEraseToolLocalOverlayStore.getState().reset()
}
