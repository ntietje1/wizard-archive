import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PublishedMapPinMenuState } from './state-context-value'
import {
  PublishedMapPinMenuStateContext,
  SetPublishedMapPinMenuStateContext,
} from './state-context-value'

export function MapPinMenuStateProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<PublishedMapPinMenuState | null>(null)

  return (
    <SetPublishedMapPinMenuStateContext.Provider value={setPublished}>
      <PublishedMapPinMenuStateContext.Provider value={published}>
        {children}
      </PublishedMapPinMenuStateContext.Provider>
    </SetPublishedMapPinMenuStateContext.Provider>
  )
}
