import { createContext, use, useMemo } from 'react'
import type { AnyItem } from '../workspace/items'
import { scopeDropTargetData } from './drop-target-data'
import type { DropInput, DropPayload } from './drop-command'

type DndDropPayloadDispatcher = (input: {
  payload: DropPayload
  rawTarget: Record<string, unknown> | null
  dropInput: DropInput
}) => Promise<void>

export interface DndValue {
  canAcceptExternalFiles: boolean
  dispatchDropPayload: DndDropPayloadDispatcher
  getItemLinkPath: (item: AnyItem) => ReadonlyArray<string>
  runtimeId: string
}

export const DndProviderContext = createContext<DndValue | null>(null)

DndProviderContext.displayName = 'DndProviderContext'

export function useCanAcceptExternalFiles() {
  return use(DndProviderContext)?.canAcceptExternalFiles === true
}

export function useDndDropPayloadDispatcher(): DndDropPayloadDispatcher {
  const context = use(DndProviderContext)
  if (!context) {
    return () => Promise.reject(new Error('DndRuntimeProvider is required for native URL drops'))
  }
  return context.dispatchDropPayload
}

export function useDndRuntimeDropData<TData extends Record<string, unknown>>(data: TData): TData {
  const runtimeId = use(DndProviderContext)?.runtimeId ?? null
  return useMemo(() => scopeDropTargetData(data, runtimeId), [data, runtimeId])
}

export function useOptionalDndRuntimeDropData<TData extends Record<string, unknown>>(
  data: TData | null,
): TData | null {
  const runtimeId = use(DndProviderContext)?.runtimeId ?? null
  return useMemo(() => (data ? scopeDropTargetData(data, runtimeId) : null), [data, runtimeId])
}
