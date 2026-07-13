import { useEffect, useRef, useState } from 'react'

export type ResourceHydrationEntry<SourceId extends string, ResourceKey extends string, Value> =
  | { status: 'loading'; sourceId: SourceId; key: ResourceKey }
  | { status: 'success'; sourceId: SourceId; key: ResourceKey; value: Value }
  | { status: 'error'; sourceId: SourceId; key: ResourceKey; error: unknown }

type ResourceHydrationState<SourceId extends string, ResourceKey extends string, Value> = Record<
  string,
  ResourceHydrationEntry<SourceId, ResourceKey, Value> | undefined
>

type ResourceHydrationRequest<SourceId extends string, ResourceKey extends string> = {
  sourceId: SourceId | null | undefined
  key: ResourceKey | null | undefined
}

export function useResourceHydrationCache<
  SourceId extends string,
  ResourceKey extends string,
  Value,
>({ load }: { load: (key: ResourceKey) => Promise<Value> }) {
  const mountedRef = useRef(true)
  const requestIdsRef = useRef(new Map<string, number>())
  const [state, setState] = useState<ResourceHydrationState<SourceId, ResourceKey, Value>>({})
  const stateRef = useRef<ResourceHydrationState<SourceId, ResourceKey, Value>>({})

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const getEntry = ({ key, sourceId }: ResourceHydrationRequest<SourceId, ResourceKey>) => {
    if (!sourceId || !key) return undefined
    return state[createResourceHydrationKey(sourceId, key)]
  }

  const ensure = ({ key, sourceId }: ResourceHydrationRequest<SourceId, ResourceKey>) => {
    if (!sourceId || !key) return
    const hydrationKey = createResourceHydrationKey(sourceId, key)
    const currentEntry = stateRef.current[hydrationKey]
    if (currentEntry && currentEntry.status !== 'error') return

    const requestId = (requestIdsRef.current.get(hydrationKey) ?? 0) + 1
    requestIdsRef.current.set(hydrationKey, requestId)
    updateState((currentState) => ({
      ...currentState,
      [hydrationKey]: { status: 'loading', sourceId, key },
    }))

    void load(key).then(
      (value) => {
        if (!mountedRef.current || requestIdsRef.current.get(hydrationKey) !== requestId) return
        updateState((currentState) => ({
          ...currentState,
          [hydrationKey]: { status: 'success', sourceId, key, value },
        }))
      },
      (error: unknown) => {
        if (!mountedRef.current || requestIdsRef.current.get(hydrationKey) !== requestId) return
        updateState((currentState) => ({
          ...currentState,
          [hydrationKey]: { status: 'error', sourceId, key, error },
        }))
      },
    )
  }

  const invalidateSource = (sourceId: SourceId | null | undefined) => {
    if (!sourceId) return
    updateState((currentState) => {
      let changed = false
      const nextState = { ...currentState }
      for (const [hydrationKey, entry] of Object.entries(currentState)) {
        if (entry?.sourceId !== sourceId) continue
        requestIdsRef.current.set(hydrationKey, (requestIdsRef.current.get(hydrationKey) ?? 0) + 1)
        delete nextState[hydrationKey]
        changed = true
      }
      return changed ? nextState : currentState
    })
  }

  return { ensure, getEntry, invalidateSource }

  function updateState(
    updater: (
      currentState: ResourceHydrationState<SourceId, ResourceKey, Value>,
    ) => ResourceHydrationState<SourceId, ResourceKey, Value>,
  ) {
    const nextState = updater(stateRef.current)
    if (nextState === stateRef.current) return
    stateRef.current = nextState
    setState(nextState)
  }
}

function createResourceHydrationKey(sourceId: string, key: string) {
  return JSON.stringify([sourceId, key])
}
