import * as Y from 'yjs'
import { useEffect, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConvexYjsProvider } from '../providers/convex-yjs-provider'
import type { Id } from 'convex/_generated/dataModel'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

type YjsState = {
  doc: Y.Doc
  provider: ConvexYjsProvider
  instanceId: number
}

let nextInstanceId = 1

export function useConvexYjsCollaboration(
  documentId: Id<'notes'>,
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
        convex.mutation(api.yjsSync.mutations.pushUpdate, args),
      pushAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.pushAwareness, args),
      removeAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.removeAwareness, args),
      persistBlocks: (args) =>
        convex.mutation(api.yjsSync.mutations.persistBlocks, args),
    })

    setState({ doc, provider, instanceId: nextInstanceId++ })

    return () => {
      provider.destroy()
      doc.destroy()
      setState(null)
    }
  }, [documentId, convex])

  useEffect(() => {
    if (state) state.provider.setUser(user)
  }, [state, user.name, user.color])

  useEffect(() => {
    if (state) state.provider.writable = canEdit
  }, [state, canEdit])

  const updatesResult = useAuthQuery(api.yjsSync.queries.getUpdates, {
    documentId,
    afterSeq,
  })

  useEffect(() => {
    if (updatesResult.data && state) {
      state.provider.applyRemoteUpdates(updatesResult.data)
      if (afterSeq === undefined && updatesResult.data.length > 0) {
        setAfterSeq(state.provider.lastAppliedSeq)
      }
      if (isLoading) setIsLoading(false)
    }
  }, [updatesResult.data, state])

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
  }
}
