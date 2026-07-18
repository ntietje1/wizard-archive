import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import {
  accessCommandInputRejection,
  normalizeNoteBlockAccessCommand,
} from '@wizard-archive/editor/resources/command-protocol'
import type {
  CommandDelivery,
  NoteBlockAccessCommand,
  NoteBlockAccessCommandResult,
  NoteBlockAccessReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { NoteBlockAccessGateway } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { NoteBlockAccessPresentation } from '@wizard-archive/editor/resources/note-block-access-policy'
import { createLivePresentationStore } from './live-presentation-store'

type ExecuteArgs = FunctionArgs<typeof api.resources.mutations.executeNoteBlockAccessCommand>
type ExecuteResult = FunctionReturnType<
  typeof api.resources.mutations.executeNoteBlockAccessCommand
>
type PresentationSnapshot = FunctionReturnType<typeof api.resources.queries.loadNoteBlockAccess>
type ExecuteMutation = (args: ExecuteArgs) => Promise<ExecuteResult>
type WatchPresentation = (
  noteId: ResourceId,
  apply: (value: PresentationSnapshot) => void,
) => () => void

type LiveNoteBlockAccessGateway = NoteBlockAccessGateway & Readonly<{ dispose(): void }>

export function createLiveNoteBlockAccessGateway(
  campaignId: CampaignId,
  executeMutation: ExecuteMutation | null,
  watchPresentation: WatchPresentation | null,
): LiveNoteBlockAccessGateway {
  const presentations = createLivePresentationStore(
    watchPresentation
      ? (noteId: ResourceId, apply: (value: NoteBlockAccessPresentation | null) => void) =>
          watchPresentation(noteId, (value) =>
            apply(value === null ? null : readPresentation(value)),
          )
      : null,
  )
  return {
    getPresentation: presentations.get,
    loadPresentation: presentations.load,
    subscribe: presentations.subscribe,
    execute: async (envelope) => {
      if (envelope.campaignId !== campaignId) return scopeUnavailable()
      if (!executeMutation) return unauthorized()
      let command: NoteBlockAccessCommand
      try {
        command = normalizeNoteBlockAccessCommand(envelope.command)
      } catch (error) {
        return {
          status: 'received',
          result: {
            status: 'rejected',
            reason: accessCommandInputRejection(error),
          },
        }
      }
      try {
        const value = await executeMutation({
          campaignId,
          operationId: envelope.operationId,
          command: { ...command, blockIds: [...command.blockIds] },
        })
        const result = readResult(value)
        if (
          result.status === 'completed' &&
          (result.receipt.campaignId !== campaignId ||
            result.receipt.operationId !== envelope.operationId ||
            result.receipt.noteId !== command.noteId)
        ) {
          throw new TypeError('Note block access receipt does not match its envelope')
        }
        return { status: 'received', result }
      } catch {
        return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
      }
    },
    dispose: presentations.dispose,
  }
}

function readPresentation(value: Exclude<PresentationSnapshot, null>): NoteBlockAccessPresentation {
  return {
    noteId: assertDomainId(DOMAIN_ID_KIND.resource, value.noteId),
    blocks: value.blocks.map((block) => ({
      blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, block.blockId),
      audienceVisibility: block.audienceVisibility,
      memberAccess: block.memberAccess.map((access) => ({
        memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, access.memberId),
        visibility: access.visibility,
      })),
    })),
    participants: value.participants.map((participant) => ({
      ...participant,
      id: assertDomainId(DOMAIN_ID_KIND.campaignMember, participant.id),
    })),
  }
}

function readResult(value: ExecuteResult): NoteBlockAccessCommandResult {
  if (value.status !== 'completed') return value
  return { status: 'completed', receipt: readReceipt(value.receipt) }
}

function readReceipt(
  value: Extract<ExecuteResult, { status: 'completed' }>['receipt'],
): NoteBlockAccessReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, value.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, value.operationId),
    noteId: assertDomainId(DOMAIN_ID_KIND.resource, value.noteId),
    blockIds: value.blockIds.map((blockId) => assertDomainId(DOMAIN_ID_KIND.noteBlock, blockId)),
  }
}

function unauthorized(): CommandDelivery<NoteBlockAccessCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'unauthorized' },
  }
}

function scopeUnavailable(): CommandDelivery<NoteBlockAccessCommandResult> {
  return {
    status: 'received',
    result: { status: 'unavailable', reason: 'scope_unavailable' },
  }
}
