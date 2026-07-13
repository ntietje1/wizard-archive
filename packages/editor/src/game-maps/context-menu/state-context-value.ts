import { createContext, use } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { MapPinMenuServiceState } from './service'

export interface PublishedMapPinMenuState {
  owner: symbol
  state: MapPinMenuServiceState
}

type SetPublishedMapPinMenuState = Dispatch<SetStateAction<PublishedMapPinMenuState | null>>

export const PublishedMapPinMenuStateContext = createContext<PublishedMapPinMenuState | null>(null)
export const SetPublishedMapPinMenuStateContext = createContext<SetPublishedMapPinMenuState | null>(
  null,
)

export function usePublishedMapPinMenuState() {
  return use(PublishedMapPinMenuStateContext)
}

export function useSetPublishedMapPinMenuState() {
  return use(SetPublishedMapPinMenuStateContext)
}
