import { describe, expect, it } from 'vite-plus/test'
import type { NoteSessionState, NoteSessionSource } from '../content-session-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryWorkspaceSearch } from '../in-memory-workspace-discovery'
import type { ResourceRecord } from '../resource-record'
import { canonicalizeResourceTitle } from '../resource-record'
import { initialVersion, sha256Digest } from '../component-version'
import { createInMemoryNoteSession } from '../in-memory-note-session'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'

describe('in-memory workspace search', () => {
  it('maintains note search documents instead of decoding content per query', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden citadel' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const version = initialVersion(await sha256Digest(new TextEncoder().encode('note')))
    const session = createInMemoryNoteSession(document, version)
    let state: NoteSessionState = { status: 'ready', session }
    let getCount = 0
    let resourceListener: (() => void) | undefined
    const noteListeners = new Set<() => void>()
    const setState = (next: NoteSessionState) => {
      state = next
      for (const listener of noteListeners) listener()
    }
    const notes: NoteSessionSource = {
      get: () => {
        getCount += 1
        return state
      },
      subscribe: (_resourceId, listener) => {
        noteListeners.add(listener)
        return () => noteListeners.delete(listener)
      },
      export: () => ({ status: 'unavailable', reason: 'capability_not_supported' }),
      create: () =>
        Promise.resolve({ status: 'not_committed', retryable: false, reason: 'invalid_response' }),
      dispose: () => undefined,
    }
    let resources: ReadonlyArray<ResourceRecord> = [
      {
        id: resourceId,
        campaignId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Field notes'),
        icon: null,
        color: null,
        lifecycle: { state: 'active' },
        metadataVersion: initialVersion(await sha256Digest(new TextEncoder().encode('resource'))),
        created: { at: 1, by: actorId },
        updated: { at: 1, by: actorId },
      },
    ]
    const search = createInMemoryWorkspaceSearch(
      () => resources,
      (listener) => {
        resourceListener = listener
        return () => {
          resourceListener = undefined
        }
      },
      notes,
    )

    expect(getCount).toBe(1)
    await expect(search.gateway.search('citadel')).resolves.toMatchObject([{ resourceId }])
    await expect(search.gateway.search('citadel')).resolves.toMatchObject([{ resourceId }])
    expect(getCount).toBe(1)

    const replacementDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Sunken archive' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const replacementSession = createInMemoryNoteSession(replacementDocument, version)
    setState({ status: 'ready', session: replacementSession })
    expect(getCount).toBe(2)
    await expect(search.gateway.search('archive')).resolves.toMatchObject([{ resourceId }])

    resources = [{ ...resources[0]!, title: canonicalizeResourceTitle('Renamed notes') }]
    resourceListener?.()
    await expect(search.gateway.search('renamed')).resolves.toMatchObject([{ resourceId }])
    expect(getCount).toBe(2)

    search.dispose()
    expect(noteListeners.size).toBe(0)
    session.dispose()
    replacementSession.dispose()
  })
})
