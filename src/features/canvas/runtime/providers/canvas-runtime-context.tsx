import type { ReactNode } from 'react'
import {
  CanvasDocumentServicesContext,
  CanvasDomRuntimeContext,
  CanvasInteractionServicesContext,
  CanvasPresenceServicesContext,
} from './canvas-runtime'
import type {
  CanvasDocumentServices,
  CanvasInteractionServices,
  CanvasPresenceServices,
} from './canvas-runtime'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'

export interface CanvasRuntimeProviderProps {
  children: ReactNode
  domRuntime: CanvasDomRuntime
  documentServices: CanvasDocumentServices
  interactionServices: CanvasInteractionServices
  presenceServices: CanvasPresenceServices
}

export function CanvasRuntimeProvider({
  children,
  domRuntime,
  documentServices,
  interactionServices,
  presenceServices,
}: CanvasRuntimeProviderProps) {
  return (
    <CanvasDomRuntimeContext value={domRuntime}>
      <CanvasDocumentServicesContext value={documentServices}>
        <CanvasInteractionServicesContext value={interactionServices}>
          <CanvasPresenceServicesContext value={presenceServices}>
            {children}
          </CanvasPresenceServicesContext>
        </CanvasInteractionServicesContext>
      </CanvasDocumentServicesContext>
    </CanvasDomRuntimeContext>
  )
}
