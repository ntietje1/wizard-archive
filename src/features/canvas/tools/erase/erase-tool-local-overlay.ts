import { create } from 'zustand'

interface EraseToolLocalOverlayState {
  erasingStrokeIds: Set<string>
}

interface EraseToolLocalOverlayActions {
  setErasingStrokeIds: (ids: Set<string>) => void
  reset: () => void
}

export const useEraseToolLocalOverlayStore = create<
  EraseToolLocalOverlayState & EraseToolLocalOverlayActions
>((set) => ({
  erasingStrokeIds: new Set<string>(),
  setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
  reset: () => set({ erasingStrokeIds: new Set<string>() }),
}))

export function setEraseToolErasingStrokeIds(ids: Set<string>) {
  useEraseToolLocalOverlayStore.getState().setErasingStrokeIds(ids)
}

export function clearEraseToolLocalOverlay() {
  useEraseToolLocalOverlayStore.getState().reset()
}
