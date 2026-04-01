import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { PERSIST_INTERVAL_MS } from 'convex/yjsSync/constants'
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
) {
  const convex = useConvex()
  const [state, setState] = useState<YjsState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    initialLoadDone.current = false
    setIsLoading(true)

    const doc = new Y.Doc()
    const provider = new ConvexYjsProvider(doc, documentId)

    provider.setPushUpdate((args) =>
      convex.mutation(api.yjsSync.mutations.pushUpdate, args),
    )
    provider.setPushAwareness((args) =>
      convex.mutation(api.yjsSync.mutations.pushAwareness, args),
    )
    provider.setRemoveAwareness((args) =>
      convex.mutation(api.yjsSync.mutations.removeAwareness, args),
    )

    setState({ doc, provider, instanceId: nextInstanceId++ })

    return () => {
      provider.destroy()
      doc.destroy()
      setState(null)
    }
  }, [documentId, convex])

  useEffect(() => {
    if (state) {
      state.provider.awareness.setLocalStateField('user', user)
    }
  }, [state, user.name, user.color])

  const updatesResult = useAuthQuery(api.yjsSync.queries.getUpdates, {
    documentId,
  })

  useEffect(() => {
    if (updatesResult.data && state) {
      state.provider.applyRemoteUpdates(updatesResult.data)
      if (!initialLoadDone.current) {
        initialLoadDone.current = true
        setIsLoading(false)
      }
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

  useEffect(() => {
    if (!state) return

    const persist = () => {
      convex
        .mutation(api.yjsSync.mutations.persistBlocks, {
          documentId,
        })
        .catch((err: unknown) => {
          console.error('[YJS] persist failed for', documentId, err)
        })
    }

    const persistInterval = setInterval(persist, PERSIST_INTERVAL_MS)

    return () => {
      clearInterval(persistInterval)
      persist()
    }
  }, [state, convex, documentId])

  return {
    doc: state?.doc ?? null,
    provider: state?.provider ?? null,
    instanceId: state?.instanceId ?? 0,
    isLoading: isLoading || !state,
  }
}
