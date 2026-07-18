import { useEffect, useRef, useState } from 'react'
import type { CampaignId, ResourceId } from '../domain-id'
import type { ResourceNavigation } from '../editor-runtime-contract'
import type { WorkspaceCreationSettlement } from './resource-operations'

type WorkspaceCreationState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'pending'; controlId: string }>
  | Exclude<WorkspaceCreationSettlement, { status: 'cancelled' | 'completed' }>

type ActiveCreation = {
  campaignId: CampaignId
  controlId: string
  controller: AbortController
  promise: Promise<WorkspaceCreationSettlement> | null
  retry: (() => Promise<WorkspaceCreationSettlement>) | null
  targetId: ResourceId | null
}

export function useWorkspaceCreation(
  campaignId: CampaignId,
  navigation: ResourceNavigation,
  targetId: ResourceId | null,
) {
  const active = useRef<ActiveCreation | null>(null)
  const [view, setView] = useState<Readonly<{
    campaignId: CampaignId
    state: WorkspaceCreationState
    targetId: ResourceId | null
  }> | null>(null)

  useEffect(() => {
    const retire = () => {
      const attempt = active.current
      active.current = null
      attempt?.controller.abort()
      setView(null)
    }
    const unsubscribe = navigation.subscribe(retire)
    return () => {
      unsubscribe()
      active.current?.controller.abort()
      active.current = null
    }
  }, [campaignId, navigation, targetId])

  const settle = async (
    attempt: ActiveCreation,
    deliver: () => Promise<WorkspaceCreationSettlement>,
  ): Promise<WorkspaceCreationSettlement> => {
    const settlement = await deliver()
    if (active.current !== attempt || attempt.controller.signal.aborted) {
      return { status: 'cancelled' }
    }
    if (settlement.status === 'completed') {
      active.current = null
      setView(null)
      navigation.open({ kind: 'resource', resourceId: settlement.resourceId })
      return settlement
    }
    if (settlement.status === 'cancelled') {
      active.current = null
      setView(null)
      return settlement
    }
    attempt.retry =
      settlement.status === 'indeterminate'
        ? settlement.retry
        : settlement.status === 'failed'
          ? settlement.retry
          : null
    if (!attempt.retry) active.current = null
    setView({
      campaignId: attempt.campaignId,
      targetId: attempt.targetId,
      state: settlement,
    })
    return settlement
  }

  const run = async (
    controlId: string,
    create: (signal: AbortSignal) => Promise<WorkspaceCreationSettlement>,
  ): Promise<WorkspaceCreationSettlement> => {
    const existing = active.current
    if (existing?.campaignId === campaignId && existing.targetId === targetId && existing.promise) {
      return await existing.promise
    }
    existing?.controller.abort()
    const controller = new AbortController()
    const attempt: ActiveCreation = {
      campaignId,
      controlId,
      controller,
      promise: null,
      retry: null,
      targetId,
    }
    active.current = attempt
    setView({ campaignId, targetId, state: { status: 'pending', controlId } })
    attempt.promise = settle(attempt, () => create(controller.signal))
    return await attempt.promise
  }

  const retry = async (): Promise<WorkspaceCreationSettlement | null> => {
    const attempt = active.current
    if (!attempt?.retry) return null
    const deliver = attempt.retry
    attempt.retry = null
    setView({
      campaignId: attempt.campaignId,
      targetId: attempt.targetId,
      state: { status: 'pending', controlId: attempt.controlId },
    })
    attempt.promise = settle(attempt, deliver)
    return await attempt.promise
  }

  const dismiss = () => {
    const attempt = active.current
    active.current = null
    attempt?.controller.abort()
    setView(null)
  }

  const state =
    view?.campaignId === campaignId && view.targetId === targetId
      ? view.state
      : { status: 'idle' as const }
  return {
    blocked:
      state.status === 'pending' ||
      state.status === 'indeterminate' ||
      (state.status === 'failed' && state.retry !== null),
    dismiss,
    pendingControlId: state.status === 'pending' ? state.controlId : null,
    retry,
    run,
    state,
  }
}
