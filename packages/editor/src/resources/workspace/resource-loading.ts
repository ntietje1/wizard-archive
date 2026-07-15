import { useEffect, useState } from 'react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { ResourceCollectionQuery, ResourceLoadResult } from '../resource-index-contract'

export function useEnsureResourceCollection(
  runtime: EditorRuntime,
  query: ResourceCollectionQuery,
) {
  const { lifecycle, parentId } = query
  const [attempt, setAttempt] = useState(0)
  const key = `${parentId ?? 'root'}:${lifecycle}:${attempt}`
  const [loaded, setLoaded] = useState<{ key: string; result: ResourceLoadResult } | null>(null)
  useEffect(() => {
    let current = true
    void runtime.resources.loader
      .ensureCollection({
        parentId,
        lifecycle,
        ...(query.kinds === undefined ? {} : { kinds: query.kinds }),
      })
      .then((result) => current && setLoaded({ key, result }))
    return () => {
      current = false
    }
  }, [key, lifecycle, parentId, query.kinds, runtime])
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
