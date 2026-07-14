import type { ResourceId } from '../resources/domain-id'
import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'

import type {
  AwarenessLeaseResult,
  AwarenessReleaseResult,
} from '../../../../shared/yjs-sync/awareness'
import type { YjsCollaborationProvider, YjsProviderUser } from './yjs-provider'
import { YjsProvider } from './yjs-provider-runtime'

export type YjsCollaborationUpdateEntry = {
  revision: number
  seq: number
  update: ArrayBuffer
}

export type YjsCollaborationAwarenessEntry = {
  clientId: number
  state: ArrayBuffer
  updatedAt: number
}

type YjsCollaborationLoad<T> = {
  data?: Array<T>
  isError?: boolean
  error?: Error | null
  isComplete?: boolean
  loadMore?: () => void
}

export type YjsCollaborationSourceHook<T> = (input: {
  afterSeq?: number
  documentId: ResourceId
  sourceId: string | null | undefined
}) => YjsCollaborationLoad<T>

export type YjsSessionTransport = {
  pushUpdate: (args: {
    documentId: ResourceId
    revision: number
    sourceId: string
    update: ArrayBuffer
  }) => Promise<
    { status: 'accepted'; seq: number } | { status: 'rejected'; reason: 'revision_mismatch' }
  >
  pushAwareness: (args: {
    clientId: number
    documentId: ResourceId
    sessionId: string
    sourceId: string
    state: ArrayBuffer
  }) => Promise<AwarenessLeaseResult>
  removeAwareness: (args: {
    clientId: number
    documentId: ResourceId
    sessionId: string
    sourceId: string
  }) => Promise<AwarenessReleaseResult>
  reportError: (message: string, error?: unknown) => void
}

export type YjsSessionBeforeDestroyInput = {
  documentId: ResourceId
  doc: Y.Doc
  provider: YjsCollaborationProvider
  sourceId: string
}

export type YjsCollaborationSession = {
  doc: Y.Doc | null
  error: Error | null
  instanceId: number
  isLoading: boolean
  provider: YjsCollaborationProvider | null
}

type YjsSessionState = {
  documentId: ResourceId
  doc: Y.Doc
  provider: YjsProvider
  instanceId: number
  sourceId: string
}

type UseYjsCollaborationSessionInput = {
  canEdit: boolean
  documentId: ResourceId
  onBeforeDestroy?: (state: YjsSessionBeforeDestroyInput) => Promise<void> | void
  sourceId: string | null | undefined
  transport: YjsSessionTransport
  user: YjsProviderUser
  useAwareness: YjsCollaborationSourceHook<YjsCollaborationAwarenessEntry>
  useUpdates: YjsCollaborationSourceHook<YjsCollaborationUpdateEntry>
}

let nextInstanceId = 1

export function useYjsCollaborationSession({
  canEdit,
  documentId,
  onBeforeDestroy,
  sourceId,
  transport,
  useAwareness,
  user,
  useUpdates,
}: UseYjsCollaborationSessionInput): YjsCollaborationSession {
  const [sessionState, setSessionState] = useState<YjsSessionState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [remoteResetCount, setRemoteResetCount] = useState(0)
  const onBeforeDestroyRef = useRef(onBeforeDestroy)
  const remoteResetProviderRef = useRef<YjsProvider | null>(null)
  const transportRef = useRef(transport)
  onBeforeDestroyRef.current = onBeforeDestroy
  transportRef.current = transport

  useEffect(() => {
    setIsLoading(true)
    setAfterSeq(undefined)
    setError(null)
    setSessionState(null)

    if (!sourceId) {
      setIsLoading(false)
      return
    }

    const activeSourceId = sourceId
    const doc = new Y.Doc()
    let provider: YjsProvider
    provider = new YjsProvider(doc, documentId, {
      pushUpdate: ({ revision, update }) =>
        transportRef.current.pushUpdate({
          documentId,
          revision,
          sourceId: activeSourceId,
          update,
        }),
      pushAwareness: ({ clientId, sessionId, state }) =>
        transportRef.current.pushAwareness({
          clientId,
          documentId,
          sessionId,
          sourceId: activeSourceId,
          state,
        }),
      removeAwareness: ({ clientId, sessionId }) =>
        transportRef.current.removeAwareness({
          clientId,
          documentId,
          sessionId,
          sourceId: activeSourceId,
        }),
      reportError: (message, err) => transportRef.current.reportError(message, err),
      requestReset: () => {
        if (remoteResetProviderRef.current === provider) return
        remoteResetProviderRef.current = provider
        setIsLoading(true)
        setAfterSeq(undefined)
        setRemoteResetCount((count) => count + 1)
      },
    })

    setSessionState({
      documentId,
      doc,
      provider,
      instanceId: nextInstanceId++,
      sourceId: activeSourceId,
    })

    return () => {
      if (remoteResetProviderRef.current === provider) {
        remoteResetProviderRef.current = null
        provider.destroy({ discardPendingUpdates: true })
        doc.destroy()
        return
      }

      const beforeDestroy = onBeforeDestroyRef.current
      Promise.resolve(
        beforeDestroy?.({
          documentId,
          doc,
          provider,
          sourceId: activeSourceId,
        }),
      )
        .catch((err: unknown) => {
          transportRef.current.reportError('Yjs onBeforeDestroy failed', err)
        })
        .finally(() => {
          provider.destroy()
          doc.destroy()
        })
    }
  }, [documentId, remoteResetCount, sourceId])

  const currentState =
    sourceId && sessionState?.documentId === documentId && sessionState.sourceId === sourceId
      ? sessionState
      : null

  const { name, color } = user
  useEffect(() => {
    if (currentState) currentState.provider.updateUser({ name, color })
  }, [currentState, name, color])

  useEffect(() => {
    if (currentState) currentState.provider.setWritable(canEdit)
  }, [currentState, canEdit])

  const updatesResult = useUpdates({ afterSeq, documentId, sourceId })
  const updatesData = updatesResult.data
  const updatesError = updatesResult.error
  const updatesIsComplete = updatesResult.isComplete
  const updatesIsError = updatesResult.isError
  const loadMoreUpdates = updatesResult.loadMore

  useEffect(() => {
    if (updatesIsError) {
      setIsLoading(false)
      setError(updatesError ?? null)
      return
    }
    if (updatesData && currentState) {
      setError(null)
      const isComplete = updatesIsComplete ?? true
      currentState.provider.applyRemoteUpdates(updatesData, {
        sync: isComplete,
      })
      if (!isComplete) {
        loadMoreUpdates?.()
        return
      }
      if (updatesData.length > 0) {
        setAfterSeq(currentState.provider.lastAppliedSeq)
      }
      if (isLoading) setIsLoading(false)
    }
  }, [
    updatesData,
    updatesIsError,
    updatesError,
    updatesIsComplete,
    loadMoreUpdates,
    currentState,
    isLoading,
  ])

  const awarenessResult = useAwareness({ documentId, sourceId })
  const awarenessData = awarenessResult.data
  const awarenessIsComplete = awarenessResult.isComplete
  const loadMoreAwareness = awarenessResult.loadMore

  useEffect(() => {
    if (awarenessData && currentState) {
      if (!(awarenessIsComplete ?? true)) {
        loadMoreAwareness?.()
        return
      }
      currentState.provider.applyRemoteAwareness(awarenessData)
    }
  }, [awarenessData, awarenessIsComplete, loadMoreAwareness, currentState])

  return {
    doc: currentState?.doc ?? null,
    provider: currentState?.provider ?? null,
    instanceId: currentState?.instanceId ?? 0,
    isLoading: sourceId ? isLoading || !currentState : isLoading,
    error,
  }
}
