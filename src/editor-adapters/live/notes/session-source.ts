import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { api } from 'convex/_generated/api'
import { useNoteYjsCollaboration } from './yjs-collaboration'
import { useLiveCollaborationUser } from '~/editor-adapters/live/collaboration/use-live-collaboration-user'

import {
  createWizardEditorImportedTextNotePayload,
  isPersistedWizardEditorItemId,
  updateWizardEditorYjsProviderUser,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorCommandSourceInput,
  WizardEditorNoteCollaborationSessionRequest,
  WizardEditorNoteEditorSession,
  WizardEditorNoteHeadingSessionPorts,
  WizardEditorNotePlaybackSessionPorts,
  WizardEditorResourceSlug,
  WizardEditorNoteSessionPorts,
  WizardEditorNoteValueSessionPorts,
} from '@wizard-archive/editor/adapter'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

type LiveNoteItemWithContent = WizardEditorNoteCollaborationSessionRequest['note']

function useLiveNoteCollaborationSession(
  workspaceId: string,
  canEditNote: (note: LiveNoteItemWithContent) => boolean,
  request: WizardEditorNoteCollaborationSessionRequest,
  getNoteSlugById: (noteId: ResourceId) => WizardEditorResourceSlug | null | undefined,
): WizardEditorNoteEditorSession {
  const { isLoading: userLoading, user } = useLiveCollaborationUser()
  const persistedNoteId = isPersistedWizardEditorItemId(request.note.id) ? request.note.id : null
  const sessionCanEdit =
    persistedNoteId !== null && request.mode === 'editable' && canEditNote(request.note)
  const session = useNoteYjsCollaboration(
    persistedNoteId ? workspaceId : null,
    persistedNoteId ?? request.note.id,
    user,
    sessionCanEdit,
    { getNoteSlugById },
  )

  const base = {
    instanceId: session.instanceId,
    mode: request.mode,
    user,
  }

  if (!persistedNoteId) {
    return { ...base, reason: 'optimistic_resource_pending', status: 'unavailable' }
  }
  if (userLoading || session.isLoading) return { ...base, status: 'loading' }
  if (session.error) return { ...base, error: session.error, status: 'error' }
  if (!session.doc || !session.provider) {
    return { ...base, reason: 'missing_collaboration_engine', status: 'unavailable' }
  }

  const provider = session.provider
  return {
    ...base,
    engine: { doc: session.doc, provider },
    status: 'ready',
    updateUser: (nextUser) => updateWizardEditorYjsProviderUser(provider, nextUser),
  }
}

export function useLiveNoteSessionPorts({
  canEditNote,
  getNoteSlugById,
  workspaceId,
}: {
  canEditNote: (note: LiveNoteItemWithContent) => boolean
  getNoteSlugById: (noteId: ResourceId) => WizardEditorResourceSlug | null | undefined
  workspaceId: string
}): WizardEditorNoteSessionPorts {
  return {
    document: {
      useCollaborationSession: (request) =>
        useLiveNoteCollaborationSession(workspaceId, canEditNote, request, getNoteSlugById),
    },
  }
}

export function useLiveNoteHeadingSessionPorts(): WizardEditorNoteHeadingSessionPorts {
  return {
    headings: {
      useNoteHeadings: useLiveNoteHeadings,
    },
  }
}

export function useLiveNotePlaybackSessionPorts(): WizardEditorNotePlaybackSessionPorts {
  return {
    playback: {},
  }
}

export function useLiveNoteValueSessionPorts(): WizardEditorNoteValueSessionPorts {
  return {
    values: {
      useNoteValueStates: useLiveNoteValueStates,
    },
  }
}

export function useLiveImportedTextFileInitializer(): WizardEditorCommandSourceInput['contentInitializers']['initializeImportedTextFile'] {
  const pushImportedTextNoteUpdateMutation = useCampaignMutation(
    api.yjsSync.mutations.pushImportedTextNoteUpdate,
  )

  return (input) =>
    initializeLiveImportedTextFile({
      input,
      pushImportedTextNoteUpdateMutation,
    })
}

function useLiveNoteValueStates(noteIds: Array<ResourceId>) {
  const persistedNoteIds = noteIds.filter(isPersistedWizardEditorItemId)
  const query = useCampaignQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    persistedNoteIds.length > 0 ? { noteIds: persistedNoteIds } : 'skip',
  )
  return {
    states: query.data ?? [],
    status: persistedNoteIds.length > 0 ? query.status : 'success',
  }
}

const useLiveNoteHeadings: WizardEditorNoteHeadingSessionPorts['headings']['useNoteHeadings'] = (
  noteId,
) => {
  const persistedNoteId = isPersistedWizardEditorItemId(noteId) ? noteId : null
  const query = useCampaignQuery(
    api.blocks.queries.getHeadingsByNote,
    persistedNoteId ? { noteId: persistedNoteId } : 'skip',
  )

  return {
    headings: query.data ?? [],
    status: persistedNoteId ? query.status : 'success',
  }
}

async function initializeLiveImportedTextFile({
  input,
  pushImportedTextNoteUpdateMutation,
}: {
  input: Parameters<
    WizardEditorCommandSourceInput['contentInitializers']['initializeImportedTextFile']
  >[0]
  pushImportedTextNoteUpdateMutation: ReturnType<typeof useCampaignMutation>
}) {
  const payload = await createWizardEditorImportedTextNotePayload(input.file)
  const result = await pushImportedTextNoteUpdateMutation.mutateAsync({
    documentId: input.noteId,
    revision: 0,
    update: payload.update,
    content: payload.content,
  })
  if (result.status === 'rejected') {
    throw new Error('Imported note initialization raced with a document revision change')
  }
}
