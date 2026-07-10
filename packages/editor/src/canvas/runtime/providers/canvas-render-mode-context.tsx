import { createContext } from 'react'

type CanvasRenderMode = 'interactive' | 'embedded-readonly'

export const CanvasRenderModeContext = createContext<CanvasRenderMode>('embedded-readonly')
