import * as Y from 'yjs'
import {
  EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../../resources/authored-destination'
import type { AuthoredDestination } from '../../resources/authored-destination-contract'
import type { AuthoredResourceCreationSettlement } from '../../resources/authored-destination-drop'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import type { NoteBlockId, ResourceId } from '../../resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../document/headless-yjs'

type NoteEmbedInsertionResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{
      status: 'rejected'
      reason: 'document_rejected' | 'target_changed' | 'target_missing'
    }>

const DEFAULT_NOTE_EMBED_WIDTH = 480

type NoteEmbedCreationInsertion = Readonly<{
  blockId: NoteBlockId
  canReplaceTarget: () => boolean
  currentDocument: () => Y.Doc | null
  document: Y.Doc | null
  report: ((message: string, retry?: () => void) => void) | null
}>

export function settleNoteEmbedResourceCreation(
  creation: AuthoredResourceCreationSettlement,
  insertion: NoteEmbedCreationInsertion,
): void {
  if (creation.status === 'completed') {
    const destination = resourceDestination(creation.resourceId)
    const inserted =
      insertion.document !== null &&
      insertion.canReplaceTarget() &&
      replaceEmptyNoteEmbedDestination(insertion.document, insertion.blockId, destination)
        .status === 'completed'
    if (!inserted) reportInsertionFailure(insertion, destination)
    return
  }
  const retryCreation =
    creation.status === 'indeterminate' || creation.status === 'failed' ? creation.retry : null
  const retry = retryCreation
    ? () => {
        void retryCreation().then((settlement) =>
          settleNoteEmbedResourceCreation(settlement, insertion),
        )
      }
    : undefined
  insertion.report?.(resourceCreationFailureMessage(creation), retry)
}

function replaceEmptyNoteEmbedDestination(
  document: Y.Doc,
  blockId: NoteBlockId,
  destination: AuthoredDestination,
): NoteEmbedInsertionResult {
  return mutateNoteDocument(() => {
    const container = findBlockContainer(document, blockId)
    if (!container) return { status: 'rejected', reason: 'target_missing' }
    const embed = findEmbedElement(container)
    if (!embed) return { status: 'rejected', reason: 'target_changed' }
    const serializedCurrent = embed.getAttribute('destination')
    const current =
      typeof serializedCurrent === 'string'
        ? parseSerializedAuthoredDestination(serializedCurrent)
        : null
    if (current?.kind === 'internal' && destinationsEqual(current, destination)) {
      return { status: 'completed' }
    }
    if (serializedCurrent !== EMPTY_AUTHORED_DESTINATION_SERIALIZED) {
      return { status: 'rejected', reason: 'target_changed' }
    }
    document.transact(() => {
      embed.setAttribute('destination', serializeAuthoredDestination(destination))
    })
    return { status: 'completed' }
  })
}

function appendNoteEmbedDestination(
  document: Y.Doc,
  blockId: NoteBlockId,
  destination: AuthoredDestination,
): NoteEmbedInsertionResult {
  return mutateNoteDocument(() => {
    const existing = findBlockContainer(document, blockId)
    if (existing) {
      const embed = findEmbedElement(existing)
      const serialized = embed?.getAttribute('destination')
      const existingDestination =
        typeof serialized === 'string' ? parseSerializedAuthoredDestination(serialized) : null
      if (
        existingDestination?.kind === 'internal' &&
        destinationsEqual(existingDestination, destination)
      ) {
        return { status: 'completed' }
      }
      return { status: 'rejected', reason: 'target_changed' }
    }
    const root = findRootBlockGroup(document)
    if (!root) return { status: 'rejected', reason: 'document_rejected' }
    // Let BlockNote's canonical serializer own its internal Yjs element shape.
    const source = noteBlocksToYDoc(
      [
        {
          id: blockId,
          type: 'embed',
          props: {
            destination: serializeAuthoredDestination(destination),
            previewWidth: DEFAULT_NOTE_EMBED_WIDTH,
          },
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    try {
      const created = findBlockContainer(source, blockId)
      if (!created) return { status: 'rejected', reason: 'document_rejected' }
      document.transact(() => {
        root.insert(root.length, [created.clone()])
      })
      return { status: 'completed' }
    } finally {
      source.destroy()
    }
  })
}

function mutateNoteDocument(mutate: () => NoteEmbedInsertionResult): NoteEmbedInsertionResult {
  try {
    return mutate()
  } catch {
    return { status: 'rejected', reason: 'document_rejected' }
  }
}

function destinationsEqual(left: AuthoredDestination, right: AuthoredDestination) {
  return serializeAuthoredDestination(left) === serializeAuthoredDestination(right)
}

function reportInsertionFailure(
  insertion: NoteEmbedCreationInsertion,
  destination: AuthoredDestination,
) {
  const recoveryBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
  const retry = () => {
    const document = insertion.currentDocument()
    const replaced = document
      ? replaceEmptyNoteEmbedDestination(document, insertion.blockId, destination)
      : null
    const result =
      replaced?.status === 'completed'
        ? replaced
        : document
          ? appendNoteEmbedDestination(document, recoveryBlockId, destination)
          : null
    if (result?.status === 'completed') {
      insertion.report?.('Resource inserted')
      return
    }
    insertion.report?.('Resource created, insertion failed', retry)
  }
  insertion.report?.('Resource created, insertion failed', retry)
}

function resourceCreationFailureMessage(creation: AuthoredResourceCreationSettlement) {
  switch (creation.status) {
    case 'indeterminate':
      return 'File creation status is unknown'
    case 'failed':
      return 'File creation failed'
    case 'cancelled':
      return 'File creation cancelled'
    case 'rejected':
      return 'File creation rejected'
    case 'completed':
      return 'File created'
  }
}

function resourceDestination(resourceId: ResourceId): AuthoredDestination {
  return { kind: 'internal', target: { kind: 'resource', resourceId } }
}

function findRootBlockGroup(document: Y.Doc) {
  const root = document.getXmlFragment(NOTE_YJS_FRAGMENT).toArray()[0]
  return root instanceof Y.XmlElement && root.nodeName === 'blockGroup' ? root : null
}

function findBlockContainer(document: Y.Doc, blockId: NoteBlockId): Y.XmlElement | null {
  const root = findRootBlockGroup(document)
  return root ? findBlockContainerIn(root, blockId) : null
}

function findBlockContainerIn(element: Y.XmlElement, blockId: NoteBlockId): Y.XmlElement | null {
  if (element.nodeName === 'blockContainer' && element.getAttribute('id') === blockId) {
    return element
  }
  for (const child of element.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue
    const match = findBlockContainerIn(child, blockId)
    if (match) return match
  }
  return null
}

function findEmbedElement(container: Y.XmlElement) {
  return (
    container
      .toArray()
      .find(
        (child): child is Y.XmlElement =>
          child instanceof Y.XmlElement && child.nodeName === 'embed',
      ) ?? null
  )
}
