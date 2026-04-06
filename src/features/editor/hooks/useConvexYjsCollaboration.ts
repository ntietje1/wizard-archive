import * as Y from 'yjs'
import { useEffect, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConvexYjsProvider } from '../providers/convex-yjs-provider'
import type { YjsDocumentId } from 'convex/yjsSync/functions/types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

type YjsState = {
  doc: Y.Doc
  provider: ConvexYjsProvider
  instanceId: number
}

let nextInstanceId = 1

export function useConvexYjsCollaboration(
  documentId: YjsDocumentId,
  user: { name: string; color: string },
  canEdit: boolean,
) {
  const convex = useConvex()
  const [state, setState] = useState<YjsState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)

  useEffect(() => {
    setIsLoading(true)
    setAfterSeq(undefined)

    const doc = new Y.Doc()
    const provider = new ConvexYjsProvider(doc, documentId, {
      pushUpdate: (args) =>
        convex.mutation(api.yjsSync.mutations.pushUpdate, {
          ...args,
          documentId,
        }),
      pushAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.pushAwareness, {
          ...args,
          documentId,
        }),
      removeAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.removeAwareness, {
          ...args,
          documentId,
        }),
    })

    setState({ doc, provider, instanceId: nextInstanceId++ })

    return () => {
      provider.destroy()
      doc.destroy()
      setState(null)
    }
  }, [documentId, convex])

  const { name, color } = user
  useEffect(() => {
    if (state) state.provider.setUser({ name, color })
  }, [state, name, color])

  useEffect(() => {
    if (state) state.provider.writable = canEdit
  }, [state, canEdit])

  const [error, setError] = useState<Error | null>(null)

  const updatesResult = useAuthQuery(api.yjsSync.queries.getUpdates, {
    documentId,
    afterSeq,
  })

  useEffect(() => {
    if (updatesResult.isError) {
      setIsLoading(false)
      setError(updatesResult.error)
      return
    }
    if (updatesResult.data && state) {
      setError(null)
      state.provider.applyRemoteUpdates(updatesResult.data)
      if (updatesResult.data.length > 0) {
        setAfterSeq(state.provider.lastAppliedSeq)
      }
      if (isLoading) setIsLoading(false)
    }
  }, [updatesResult.data, updatesResult.isError, updatesResult.error, state])

  const awarenessResult = useAuthQuery(api.yjsSync.queries.getAwareness, {
    documentId,
  })

  useEffect(() => {
    if (awarenessResult.data && state) {
      state.provider.applyRemoteAwareness(awarenessResult.data)
    }
  }, [awarenessResult.data, state])

  return {
    doc: state?.doc ?? null,
    provider: state?.provider ?? null,
    instanceId: state?.instanceId ?? 0,
    isLoading: isLoading || !state,
    error,
  }
}
