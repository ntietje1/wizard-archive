import type { Dispatch } from 'react'

import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  completeWizardEditorResourceCommand,
  isWizardEditorResourceCatalogCommand,
  isWizardEditorResourceSharingCommand,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
  WIZARD_EDITOR_RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorResourceCatalog,
  WizardEditorResourceCatalogCommand,
  WizardEditorResourceCommand,
  WizardEditorResourceCommandExecutionOptions,
  WizardEditorResourceCreateCommand,
  WizardEditorResourceCreateParentPlan,
  WizardEditorResourceRenameCommand,
} from '@wizard-archive/editor/adapter'
import {
  createLocalItemCreationSession,
  localItemTypeForSidebarItemType,
  localWorkspaceReducer,
} from './local-workspace-model'
import type { LocalWorkspaceAction, LocalWorkspaceState } from './local-workspace-model'
import { assertLocalCanMutate } from './local-operation-utils'
import { createCompletedLocalFileSystemCommandResult } from './local-filesystem-command-receipts'
import { createLocalFileSystemSnapshot } from './local-filesystem-snapshot'

type LocalCommittedFileSystemCommand = Exclude<
  WizardEditorResourceCommand,
  WizardEditorResourceCreateCommand | WizardEditorResourceRenameCommand
>
type LocalCreatedPathFolderEntry = {
  id: ResourceId
  key: string
  owner: symbol
}
type LocalPathFolderReservation = {
  committed: boolean
  id: ResourceId
  owners: Set<symbol>
}
type LocalCreatedTransaction = {
  creationId: ResourceId
  pathFolderEntries: Array<LocalCreatedPathFolderEntry>
}
type LocalCreateItemInput = Omit<WizardEditorResourceCreateCommand, 'type'> & {
  parentPlan?: WizardEditorResourceCreateParentPlan
}
type LocalCreateFileSystemCommand = WizardEditorResourceCreateCommand &
  Pick<LocalCreateItemInput, 'parentPlan'>

interface LocalOperationsContext {
  canEdit: boolean
  clipboardScopeId: string
  dispatch: Dispatch<LocalWorkspaceAction>
  getCatalog: () => WizardEditorResourceCatalog
  workspaceId: string
}

type LocalCommandContext = Omit<
  LocalOperationsContext,
  'clipboardScopeId' | 'getCatalog' | 'workspaceId'
> & {
  catalog: WizardEditorResourceCatalog
  createdPathFolders: Map<string, LocalPathFolderReservation>
  createdTransactions: Map<OperationId, LocalCreatedTransaction>
  creationSession: ReturnType<typeof createLocalItemCreationSession>
}

type LocalFileSystemClipboard = {
  scopeId: string
  itemIds: Array<ResourceId>
  mode: 'copy' | 'cut'
  workspaceId: string
}

let localFileSystemClipboard: LocalFileSystemClipboard | null = null

export function createLocalFileSystemHost({
  canEdit,
  dispatch,
  runtimeInstanceId,
  workspace,
}: {
  canEdit: boolean
  dispatch: Dispatch<LocalWorkspaceAction>
  runtimeInstanceId?: string
  workspace: LocalWorkspaceState
}) {
  let currentWorkspace = workspace
  const dispatchCommittedAction: Dispatch<LocalWorkspaceAction> = (action) => {
    currentWorkspace = localWorkspaceReducer(currentWorkspace, action)
    dispatch(action)
  }
  const context = {
    canEdit,
    clipboardScopeId: runtimeInstanceId ?? workspace.workspaceId,
    dispatch: dispatchCommittedAction,
    getCatalog: () => createLocalFileSystemSnapshot(currentWorkspace).catalog,
    workspaceId: workspace.workspaceId,
  }
  return createLocalItemOperations({
    ...context,
    creationSession: createLocalItemCreationSession(workspace.nextLocalItemIndex),
  })
}

function createLocalItemOperations({
  canEdit,
  creationSession,
  clipboardScopeId,
  dispatch,
  getCatalog,
  workspaceId,
}: LocalOperationsContext & {
  creationSession: ReturnType<typeof createLocalItemCreationSession>
}) {
  const createdPathFolders = new Map<string, LocalPathFolderReservation>()
  const createdTransactions = new Map<OperationId, LocalCreatedTransaction>()
  const getCommandContext = (): LocalCommandContext => ({
    canEdit,
    catalog: getCatalog(),
    createdTransactions,
    createdPathFolders,
    creationSession,
    dispatch,
  })
  const executeCommand = (
    command: WizardEditorResourceCommand,
    options?: WizardEditorResourceCommandExecutionOptions,
  ) => executeLocalFileSystemCommand(command, getCommandContext(), options)

  return {
    resourceCommandDriver: {
      executeCommand,
      discardCreatedItem: (transactionId: OperationId) => {
        const transaction = createdTransactions.get(transactionId)
        if (!transaction) return
        const itemIds = [
          ...collectLocalPathFolderRollbackItemIds(
            createdPathFolders,
            transaction.pathFolderEntries,
          ),
          transaction.creationId,
        ]
        dispatch({ type: 'trashItems', itemIds })
        dispatch({ type: 'deleteItemsForever', itemIds })
        createdTransactions.delete(transactionId)
      },
      finalizeCreatedItem: (transactionId: OperationId) => {
        const transaction = createdTransactions.get(transactionId)
        if (!transaction) return
        commitLocalPathFolderClaims(createdPathFolders, transaction.pathFolderEntries)
        createdTransactions.delete(transactionId)
      },
      undo: () => ({ status: 'unavailable' as const, reason: 'history_unsupported' }),
      redo: () => ({ status: 'unavailable' as const, reason: 'history_unsupported' }),
      canUndo: false,
      canRedo: false,
    },
    trashDialogDriver: {
      confirmDeleteForever: (itemIds: Array<ResourceId>) => {
        return executeCommand({ type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.deleteForever, itemIds })
      },
      confirmEmptyTrash: () => {
        return executeCommand({ type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.emptyTrash })
      },
    },
    clipboardDriver: {
      copy: (itemIds: Array<ResourceId>) => {
        localFileSystemClipboard = createLocalClipboard('copy', {
          itemIds,
          scopeId: clipboardScopeId,
          workspaceId,
        })
      },
      cut: (itemIds: Array<ResourceId>) => {
        assertLocalCanMutate(canEdit)
        localFileSystemClipboard = createLocalClipboard('cut', {
          itemIds,
          scopeId: clipboardScopeId,
          workspaceId,
        })
      },
      canUseClipboardOperations: canEdit,
      cancelClipboard: () => {
        const hadClipboard = canUseLocalClipboard({ scopeId: clipboardScopeId, workspaceId })
        if (hadClipboard) localFileSystemClipboard = null
        return hadClipboard
      },
      canPaste: (_targetParentId?: ResourceId | null) =>
        canEdit && canUseLocalClipboard({ scopeId: clipboardScopeId, workspaceId }),
      paste: (targetParentId: ResourceId | null = null) =>
        pasteLocalClipboard({
          catalog: getCatalog(),
          executeCommand,
          parentId: targetParentId,
          scopeId: clipboardScopeId,
          workspaceId,
        }),
    },
  }
}

function executeLocalCreateCommand(
  command: LocalCreateFileSystemCommand,
  {
    canEdit,
    createdPathFolders,
    createdTransactions,
    creationSession,
    dispatch,
  }: LocalCommandContext,
) {
  assertLocalCanMutate(canEdit)
  const localItemType = localItemTypeForSidebarItemType(command.itemType)
  const pathFolderOwner = Symbol('localPathCreate')

  const parentResolution = resolveLocalCreateParentTarget({
    createdPathFolders,
    creationSession,
    dispatch,
    parentPlan: command.parentPlan,
    parentTarget: command.parentTarget,
    pathFolderOwner,
  })
  reserveLocalPathFolderClaims(createdPathFolders, parentResolution.createdPathFolderEntries)

  const creation = creationSession.create({
    color: command.color,
    iconName: command.iconName,
    parentId: parentResolution.parentId,
    type: localItemType,
  })
  dispatch({
    type: 'createItem',
    creation,
  })
  if (command.name?.trim()) {
    dispatch({ type: 'updateItemMetadata', itemId: creation.id, title: command.name })
  }
  const transactionId = generateDomainId(DOMAIN_ID_KIND.operation)
  createdTransactions.set(transactionId, {
    creationId: creation.id,
    pathFolderEntries: parentResolution.createdPathFolderEntries,
  })
  return completeWizardEditorResourceCommand(
    command,
    [
      {
        type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.created,
        itemId: creation.id,
      },
    ],
    { transactionId },
  )
}

function executeLocalRenameCommand(
  { color, iconName, itemId, name }: Omit<WizardEditorResourceRenameCommand, 'type'>,
  { canEdit, catalog, dispatch }: LocalCommandContext,
) {
  assertLocalCanMutate(canEdit)
  const item = catalog.getKnownItemById(itemId)
  if (!item) throw new Error(`Local rename item "${String(itemId)}" was not found`)
  const renamed = name !== undefined && name !== item.name
  dispatch({
    type: 'updateItemMetadata',
    itemId,
    ...(name === undefined ? {} : { title: name }),
    ...(iconName === undefined ? {} : { iconName }),
    ...(color === undefined ? {} : { color }),
  })
  return completeWizardEditorResourceCommand(
    { type: WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.rename, itemId, name, iconName, color },
    renamed
      ? [{ type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.renamed, itemId }]
      : [{ type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.updated, itemId }],
  )
}

function executeLocalFileSystemCommand(
  command: WizardEditorResourceCommand,
  context: LocalCommandContext,
  options?: WizardEditorResourceCommandExecutionOptions,
): ReturnType<typeof completeWizardEditorResourceCommand> {
  const { canEdit } = context
  assertLocalCanMutate(canEdit)

  if (command.type === WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.create) {
    return executeLocalCreateCommand({ ...command, parentPlan: options?.createParentPlan }, context)
  }
  if (command.type === WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.rename) {
    return executeLocalRenameCommand(command, context)
  }
  return executeLocalCommittedFileSystemCommand(command, context)
}

function executeLocalCommittedFileSystemCommand(
  command: LocalCommittedFileSystemCommand,
  { catalog, dispatch }: LocalCommandContext,
): ReturnType<typeof completeWizardEditorResourceCommand> {
  if (isWizardEditorResourceSharingCommand(command)) {
    return { status: 'unsupported', reason: 'sharing_unsupported' }
  }
  if (!isWizardEditorResourceCatalogCommand(command)) {
    return { status: 'unsupported', reason: 'local_command_unsupported' }
  }

  const completeCommand = (completedCommand: WizardEditorResourceCatalogCommand) =>
    createCompletedLocalFileSystemCommandResult(completedCommand, {
      catalog,
      claimNextItemId: () => generateDomainId(DOMAIN_ID_KIND.resource),
    })

  const result = completeCommand(command)
  if (result.status === 'completed' && result.receipt.events.length > 0) {
    dispatch({ type: 'applyResourceCommandReceipt', receipt: result.receipt })
  }
  return result
}

function createLocalClipboard(
  mode: LocalFileSystemClipboard['mode'],
  {
    itemIds,
    scopeId,
    workspaceId,
  }: {
    itemIds: Array<ResourceId>
    scopeId: string
    workspaceId: string
  },
): LocalFileSystemClipboard | null {
  const uniqueItemIds = Array.from(new Set(itemIds))
  return uniqueItemIds.length > 0 ? { itemIds: uniqueItemIds, mode, scopeId, workspaceId } : null
}

function canUseLocalClipboard({ scopeId, workspaceId }: { scopeId: string; workspaceId: string }) {
  return Boolean(
    localFileSystemClipboard &&
    localFileSystemClipboard.scopeId === scopeId &&
    localFileSystemClipboard.workspaceId === workspaceId &&
    localFileSystemClipboard.itemIds.length > 0,
  )
}

function pasteLocalClipboard({
  catalog,
  executeCommand,
  parentId,
  scopeId,
  workspaceId,
}: {
  catalog: WizardEditorResourceCatalog
  executeCommand: (
    command: WizardEditorResourceCommand,
  ) => ReturnType<typeof completeWizardEditorResourceCommand>
  parentId: ResourceId | null
  scopeId: string
  workspaceId: string
}) {
  if (
    !localFileSystemClipboard ||
    localFileSystemClipboard.scopeId !== scopeId ||
    localFileSystemClipboard.workspaceId !== workspaceId
  ) {
    return {
      status: 'unavailable',
      reason: 'clipboard_empty',
    } satisfies ReturnType<typeof completeWizardEditorResourceCommand>
  }
  const { itemIds, mode } = localFileSystemClipboard
  const visibleItemIds = itemIds.filter((itemId) => catalog.getVisibleItemById(itemId))
  if (visibleItemIds.length === 0) {
    localFileSystemClipboard = null
    return {
      status: 'unavailable',
      reason: 'clipboard_empty',
    } satisfies ReturnType<typeof completeWizardEditorResourceCommand>
  }
  const result = executeCommand({
    type:
      mode === 'copy'
        ? WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy
        : WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.move,
    itemIds: visibleItemIds,
    targetParentId: parentId,
  })
  if (mode === 'cut') localFileSystemClipboard = null
  return result
}

function resolveLocalCreateParentTarget({
  createdPathFolders,
  creationSession,
  dispatch,
  parentPlan,
  parentTarget,
  pathFolderOwner,
}: {
  createdPathFolders: Map<string, LocalPathFolderReservation>
  creationSession: ReturnType<typeof createLocalItemCreationSession>
  dispatch: Dispatch<LocalWorkspaceAction>
  parentPlan: LocalCreateItemInput['parentPlan']
  parentTarget: WizardEditorResourceCreateCommand['parentTarget']
  pathFolderOwner: symbol
}): {
  createdPathFolderEntries: Array<LocalCreatedPathFolderEntry>
  parentId: ResourceId | null
} {
  if (parentTarget.kind === 'direct') {
    return { createdPathFolderEntries: [], parentId: parentTarget.parentId }
  }

  if (parentPlan?.kind !== 'path') {
    throw new Error('Local path creates require a package-owned parent plan')
  }

  const createdPathFolderEntries: Array<LocalCreatedPathFolderEntry> = []
  let currentParentId: ResourceId | null = null
  for (const targetFolder of parentPlan.folders) {
    if (targetFolder.kind === 'existing') {
      currentParentId = targetFolder.id
      continue
    }

    const existingCreatedFolderId = resolveCreatedLocalPathFolder(
      currentParentId,
      targetFolder.name,
      createdPathFolders,
      pathFolderOwner,
    )
    if (existingCreatedFolderId) {
      createdPathFolderEntries.push({
        id: existingCreatedFolderId,
        key: createLocalPathFolderKey(currentParentId, targetFolder.name),
        owner: pathFolderOwner,
      })
      currentParentId = existingCreatedFolderId
      continue
    }

    const creation = creationSession.create({
      parentId: currentParentId,
      type: 'folder',
    })
    const folderId = creation.id
    dispatch({
      type: 'createItem',
      creation,
    })
    dispatch({ type: 'updateItemMetadata', itemId: folderId, title: targetFolder.name })
    createdPathFolderEntries.push({
      id: folderId,
      key: createLocalPathFolderKey(currentParentId, targetFolder.name),
      owner: pathFolderOwner,
    })
    currentParentId = folderId
  }

  return { createdPathFolderEntries, parentId: currentParentId }
}

function resolveCreatedLocalPathFolder(
  parentId: ResourceId | null,
  name: string,
  createdPathFolders: ReadonlyMap<string, LocalPathFolderReservation>,
  owner: symbol,
) {
  const reservation = createdPathFolders.get(createLocalPathFolderKey(parentId, name))
  if (!reservation) return undefined
  reservation.owners.add(owner)
  return reservation.id
}

function reserveLocalPathFolderClaims(
  createdPathFolders: Map<string, LocalPathFolderReservation>,
  entries: Array<LocalCreatedPathFolderEntry>,
) {
  for (const entry of entries) {
    const reservation = createdPathFolders.get(entry.key)
    if (reservation) {
      reservation.owners.add(entry.owner)
      continue
    }
    createdPathFolders.set(entry.key, {
      committed: false,
      id: entry.id,
      owners: new Set([entry.owner]),
    })
  }
}

function commitLocalPathFolderClaims(
  createdPathFolders: Map<string, LocalPathFolderReservation>,
  entries: Array<LocalCreatedPathFolderEntry>,
) {
  for (const entry of entries) {
    const reservation = createdPathFolders.get(entry.key)
    if (!reservation || reservation.id !== entry.id) continue
    reservation.committed = true
    reservation.owners.delete(entry.owner)
  }
}

function collectLocalPathFolderRollbackItemIds(
  createdPathFolders: Map<string, LocalPathFolderReservation>,
  entries: Array<LocalCreatedPathFolderEntry>,
) {
  const itemIds: Array<ResourceId> = []
  for (const entry of entries) {
    const reservation = createdPathFolders.get(entry.key)
    if (!reservation || reservation.id !== entry.id) continue
    reservation.owners.delete(entry.owner)
    if (reservation.committed || reservation.owners.size > 0) continue
    createdPathFolders.delete(entry.key)
    itemIds.push(entry.id)
  }
  return itemIds
}

function createLocalPathFolderKey(parentId: ResourceId | null, name: string) {
  return `${parentId ?? 'root'}:${normalizeLocalPathFolderName(name)}`
}

function normalizeLocalPathFolderName(name: string) {
  return name.trim().toLowerCase()
}
