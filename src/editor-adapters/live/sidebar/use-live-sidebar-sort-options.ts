import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { WIZARD_EDITOR_DEFAULT_SORT_OPTIONS } from '@wizard-archive/editor/adapter'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { WizardEditorSortOptions } from '@wizard-archive/editor/adapter'
import { liveWorkspacePreferencesQuery } from '~/editor-adapters/live/live-workspace-preferences'
import type { LiveWorkspacePreferences } from '~/editor-adapters/live/live-workspace-preferences'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { handleError } from '~/shared/utils/logger'

interface LiveSidebarSortOptions {
  options: WizardEditorSortOptions
  setOptions: (options: WizardEditorSortOptions) => void
}

type WorkspaceScopedSortOptions = {
  workspaceRecordId: CampaignId
  options: WizardEditorSortOptions
}

type SidebarSortMutationContext = {
  workspaceRecordId: CampaignId
  mutationId: number
  nextSortOptions: WizardEditorSortOptions
  previousMutationId: number | null
  previousSortOptions: WizardEditorSortOptions
  queryKey: ReadonlyArray<unknown>
}

export function useLiveSidebarSortOptions(): LiveSidebarSortOptions {
  const { campaignId: workspaceRecordId } = useCampaign()
  const queryClient = useQueryClient()
  const currentEditor = useCampaignQuery(api.editors.queries.getCurrentEditor, {})
  const [pendingSortOptions, setPendingSortOptions] = useState<WorkspaceScopedSortOptions | null>(
    null,
  )
  const [fallbackSortOptions, setFallbackSortOptions] = useState<WorkspaceScopedSortOptions | null>(
    null,
  )
  const nextMutationId = useRef(0)
  const latestMutationIds = useRef(new Map<CampaignId, number>())
  const mutationContexts = useRef(new Map<number, SidebarSortMutationContext>())
  const currentSortOptionsRef = useRef(WIZARD_EDITOR_DEFAULT_SORT_OPTIONS)
  const activeWorkspaceRecordIdRef = useRef(workspaceRecordId)
  activeWorkspaceRecordIdRef.current = workspaceRecordId
  const activePendingSortOptions =
    pendingSortOptions && pendingSortOptions.workspaceRecordId === workspaceRecordId
      ? pendingSortOptions.options
      : null
  const activeFallbackSortOptions =
    fallbackSortOptions && fallbackSortOptions.workspaceRecordId === workspaceRecordId
      ? fallbackSortOptions.options
      : null

  const savedSortOptions = currentEditor.data
    ? editorSortOptions(currentEditor.data)
    : (activeFallbackSortOptions ?? WIZARD_EDITOR_DEFAULT_SORT_OPTIONS)
  const currentSortOptions = activePendingSortOptions ?? savedSortOptions
  currentSortOptionsRef.current = currentSortOptions
  const clearPendingSortOptionsForWorkspace = (settledWorkspaceRecordId: CampaignId) => {
    setPendingSortOptions((current) =>
      current?.workspaceRecordId === settledWorkspaceRecordId ? null : current,
    )
  }
  const deleteMutationContext = (mutationId: number) => {
    mutationContexts.current.delete(mutationId)
  }
  const rollbackLatestFailedMutation = (context: SidebarSortMutationContext) => {
    const activeWorkspaceRecordId = activeWorkspaceRecordIdRef.current
    const pendingPreviousMutationId =
      context.previousMutationId && mutationContexts.current.has(context.previousMutationId)
        ? context.previousMutationId
        : null
    if (pendingPreviousMutationId) {
      latestMutationIds.current.set(context.workspaceRecordId, pendingPreviousMutationId)
    } else {
      latestMutationIds.current.delete(context.workspaceRecordId)
    }
    if (context.workspaceRecordId === activeWorkspaceRecordId) {
      setFallbackSortOptions({
        workspaceRecordId: context.workspaceRecordId,
        options: context.previousSortOptions,
      })
      setPendingSortOptions(
        pendingPreviousMutationId
          ? { workspaceRecordId: context.workspaceRecordId, options: context.previousSortOptions }
          : null,
      )
      currentSortOptionsRef.current = context.previousSortOptions
    } else {
      clearPendingSortOptionsForWorkspace(context.workspaceRecordId)
    }
    queryClient.setQueryData(context.queryKey, (old: LiveWorkspacePreferences | null | undefined) =>
      applySortOptionsToEditor(old, context.previousSortOptions),
    )
    deleteMutationContext(context.mutationId)
  }
  const handleOutdatedFailedMutation = (context: SidebarSortMutationContext) => {
    rebasePendingSortRollback(context, mutationContexts.current)
    deleteMutationContext(context.mutationId)
  }
  const recordSettledFallback = (
    context: SidebarSortMutationContext,
    settledSortOptions: WizardEditorSortOptions,
  ) => {
    if (context.workspaceRecordId === activeWorkspaceRecordIdRef.current) {
      setFallbackSortOptions({
        workspaceRecordId: context.workspaceRecordId,
        options: settledSortOptions,
      })
    }
  }
  const clearSettledPendingSortOptions = (context: SidebarSortMutationContext) => {
    if (context.mutationId !== latestMutationIds.current.get(context.workspaceRecordId)) return
    if (context.workspaceRecordId === activeWorkspaceRecordIdRef.current) {
      setPendingSortOptions(null)
      return
    }
    clearPendingSortOptionsForWorkspace(context.workspaceRecordId)
  }

  const setCurrentEditor = useCampaignMutation(api.editors.mutations.setCurrentEditor, {
    onMutate: async (options) => {
      if (!workspaceRecordId) return
      const previousMutationId = latestMutationIds.current.get(workspaceRecordId) ?? null
      const mutationId = nextMutationId.current + 1
      nextMutationId.current = mutationId
      latestMutationIds.current.set(workspaceRecordId, mutationId)

      const queryOptions = liveWorkspacePreferencesQuery(workspaceRecordId)

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey })

      const previousMutation = previousMutationId
        ? mutationContexts.current.get(previousMutationId)
        : undefined
      const previousSortOptions =
        previousMutationId && previousMutation
          ? previousMutation.nextSortOptions
          : currentSortOptionsRef.current
      const nextSortOptions: WizardEditorSortOptions = {
        order: options.sortOrder ?? WIZARD_EDITOR_DEFAULT_SORT_OPTIONS.order,
        direction: options.sortDirection ?? WIZARD_EDITOR_DEFAULT_SORT_OPTIONS.direction,
      }
      setPendingSortOptions({ workspaceRecordId, options: nextSortOptions })
      currentSortOptionsRef.current = nextSortOptions

      queryClient.setQueryData(
        queryOptions.queryKey,
        (old: LiveWorkspacePreferences | null | undefined) => {
          if (!old) return old
          return {
            ...old,
            sortOrder: nextSortOptions.order,
            sortDirection: nextSortOptions.direction,
          }
        },
      )

      const context: SidebarSortMutationContext = {
        mutationId,
        nextSortOptions,
        previousMutationId,
        previousSortOptions,
        queryKey: queryOptions.queryKey,
        workspaceRecordId,
      }
      mutationContexts.current.set(mutationId, context)
      return context
    },
    onError: (err, _vars, context) => {
      if (!context) {
        handleError(err, 'Failed to save sort options')
        return
      }
      const latestWorkspaceMutationId =
        latestMutationIds.current.get(context.workspaceRecordId) ?? 0
      if (context.mutationId !== latestWorkspaceMutationId) {
        handleOutdatedFailedMutation(context)
      } else {
        rollbackLatestFailedMutation(context)
      }
      handleError(err, 'Failed to save sort options')
    },
    onSettled: (_data, error, vars, context) => {
      if (!context) return
      const latestWorkspaceMutationId =
        latestMutationIds.current.get(context.workspaceRecordId) ?? 0
      const settledSortOptions = sortOptionsFromMutationVars(vars)
      if (context.mutationId !== latestWorkspaceMutationId) {
        if (!error) recordSettledFallback(context, settledSortOptions)
        deleteMutationContext(context.mutationId)
        return
      }
      if (error) return
      recordSettledFallback(context, settledSortOptions)
      deleteMutationContext(context.mutationId)
      const queryOptions = liveWorkspacePreferencesQuery(context.workspaceRecordId)
      void queryClient
        .invalidateQueries({ queryKey: queryOptions.queryKey })
        .finally(() => clearSettledPendingSortOptions(context))
    },
  })

  return {
    options: currentSortOptions,
    setOptions: (options: WizardEditorSortOptions) => {
      setCurrentEditor.mutate({
        sortOrder: options.order,
        sortDirection: options.direction,
      })
    },
  }
}

function editorSortOptions(editor: LiveWorkspacePreferences): WizardEditorSortOptions {
  return {
    order: editor.sortOrder,
    direction: editor.sortDirection,
  }
}

function applySortOptionsToEditor(
  editor: LiveWorkspacePreferences | null | undefined,
  sortOptions: WizardEditorSortOptions,
): LiveWorkspacePreferences | null | undefined {
  if (!editor) return editor
  return {
    ...editor,
    sortOrder: sortOptions.order,
    sortDirection: sortOptions.direction,
  }
}

function sortOptionsFromMutationVars(vars: {
  sortOrder?: WizardEditorSortOptions['order'] | null
  sortDirection?: WizardEditorSortOptions['direction'] | null
}): WizardEditorSortOptions {
  return {
    order: vars.sortOrder ?? WIZARD_EDITOR_DEFAULT_SORT_OPTIONS.order,
    direction: vars.sortDirection ?? WIZARD_EDITOR_DEFAULT_SORT_OPTIONS.direction,
  }
}

function rebasePendingSortRollback(
  failedContext: SidebarSortMutationContext | undefined,
  contexts: Map<number, SidebarSortMutationContext>,
) {
  if (!failedContext) return
  for (const context of contexts.values()) {
    if (context.previousMutationId !== failedContext.mutationId) continue
    context.previousMutationId = failedContext.previousMutationId
    context.previousSortOptions = failedContext.previousSortOptions
  }
}
