import { useEffect, useState } from 'react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { ResourceCollectionQuery, ResourceLoadResult } from '../resource-index-contract'
import {
  resourceCollectionQueryFromKey,
  resourceCollectionQueryKey,
} from '../resource-index-contract'

export function useEnsureResourceCollection(
  runtime: EditorRuntime,
  query: ResourceCollectionQuery,
  loadOnMount = true,
) {
  const [attempt, setAttempt] = useState(0)
  const queryKey = resourceCollectionQueryKey(query)
  const key = `${queryKey}:${attempt}`
  const [loaded, setLoaded] = useState<{ key: string; result: ResourceLoadResult } | null>(null)
  const settled = loaded?.key === key
  useEffect(() => {
    if ((!loadOnMount && attempt === 0) || settled) return
    let current = true
    void runtime.resources.loader
      .ensureCollection(resourceCollectionQueryFromKey(queryKey))
      .then((result) => current && setLoaded({ key, result }))
    return () => {
      current = false
    }
  }, [attempt, key, loadOnMount, queryKey, runtime, settled])
  return {
    result: loaded?.key === key ? loaded.result : null,
    retry: () => setAttempt((value) => value + 1),
  }
}

export function useEnsureResource(runtime: EditorRuntime, resourceId: ResourceId | null) {
  const [attempt, setAttempt] = useState(0)
  const key = `${resourceId ?? 'none'}:${attempt}`
  const [loaded, setLoaded] = useState<{ key: string; result: ResourceLoadResult } | null>(null)
  useEffect(() => {
    let current = true
    if (resourceId) {
      void runtime.resources.loader
        .ensureResource(resourceId)
        .then((result) => current && setLoaded({ key, result }))
    }
    return () => {
      current = false
    }
  }, [key, resourceId, runtime])
  return {
    result: loaded?.key === key ? loaded.result : null,
    retry: () => setAttempt((value) => value + 1),
  }
}
