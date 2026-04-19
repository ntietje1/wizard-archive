import { create } from 'zustand'
import type { Point2D } from '../../utils/canvas-awareness-types'

interface LassoToolLocalOverlayState {
  points: Array<Point2D>
}

interface LassoToolLocalOverlayActions {
  setPoints: (points: Array<Point2D>) => void
  reset: () => void
}

export const useLassoToolLocalOverlayStore = create<
  LassoToolLocalOverlayState & LassoToolLocalOverlayActions
>((set) => ({
  points: [],
  setPoints: (points) => set({ points }),
  reset: () => set({ points: [] }),
}))

export function setLassoToolLocalPoints(points: Array<Point2D>) {
  useLassoToolLocalOverlayStore.getState().setPoints(points)
}

export function clearLassoToolLocalOverlay() {
  useLassoToolLocalOverlayStore.getState().reset()
}
