import { describe, expect, it, vi } from 'vite-plus/test'
import type { NoteSessionState, NoteSessionSource } from '../content-session-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryWorkspaceSearch } from '../in-memory-workspace-discovery'
import type { ResourceRecord } from '../resource-record'
import { canonicalizeResourceTitle } from '../resource-record'
import { initialVersion, sha256Digest } from '../component-version'
import { createInMemoryNoteSession } from '../in-memory-note-session'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'

describe('in-memory workspace search', () => {
  it('scans current note state on demand without document subscriptions', async () => {
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
    const subscribe = vi.fn(() => () => undefined)
    const notes: NoteSessionSource = {
      get: () => {
        getCount += 1
        return state
      },
      subscribe,
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
    const search = createInMemoryWorkspaceSearch(() => resources, notes)

    expect(getCount).toBe(0)
    await expect(search.gateway.search('citadel')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId }],
    })
    await expect(search.gateway.search('citadel')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId }],
    })
    expect(getCount).toBe(2)

    const replacementDocument = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Sunken archive' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const replacementSession = createInMemoryNoteSession(replacementDocument, version)
    state = { status: 'ready', session: replacementSession }
    await expect(search.gateway.search('archive')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId }],
    })

    state = { status: 'unavailable', reason: 'scope_unavailable' }
    await expect(search.gateway.search('archive')).resolves.toEqual({
      status: 'complete',
      results: [],
    })
    await expect(search.gateway.search('field')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId, match: { type: 'title' } }],
    })

    state = { status: 'ready', session: replacementSession }
    resources = [{ ...resources[0]!, title: canonicalizeResourceTitle('Renamed notes') }]
    await expect(search.gateway.search('renamed')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId }],
    })
    expect(getCount).toBe(6)

    resources = [
      {
        ...resources[0]!,
        lifecycle: { state: 'trashed', at: 2, by: actorId },
      },
    ]
    await expect(search.gateway.search('archive')).resolves.toEqual({
      status: 'complete',
      results: [],
    })
    expect(getCount).toBe(6)

    resources = [{ ...resources[0]!, lifecycle: { state: 'active' } }]
    await expect(search.gateway.search('archive')).resolves.toMatchObject({
      status: 'complete',
      results: [{ resourceId }],
    })
    expect(getCount).toBe(7)
    expect(subscribe).not.toHaveBeenCalled()

    search.dispose()
    session.dispose()
    replacementSession.dispose()
  })

  it('uses shared bounded ranking for duplicate, Unicode, and broad title matches', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const version = initialVersion(await sha256Digest(new TextEncoder().encode('resource')))
    const resources: ReadonlyArray<ResourceRecord> = Array.from({ length: 512 }, (_, index) => ({
      id: generateDomainId(DOMAIN_ID_KIND.resource),
      campaignId,
      parentId: null,
      kind: 'file' as const,
      title: canonicalizeResourceTitle(index < 2 ? 'Résumé archive' : `Archive ${index}`),
      icon: null,
      color: null,
      lifecycle: { state: 'active' as const },
      metadataVersion: version,
      created: { at: 1, by: actorId },
      updated: { at: 1, by: actorId },
    }))
    const get = vi.fn((): NoteSessionState => ({ status: 'loading' }))
    const subscribe = vi.fn(() => () => undefined)
    const notes: NoteSessionSource = {
      get,
      subscribe,
      export: () => ({ status: 'unavailable', reason: 'capability_not_supported' }),
      create: () =>
        Promise.resolve({ status: 'not_committed', retryable: false, reason: 'invalid_response' }),
      dispose: () => undefined,
    }
    const search = createInMemoryWorkspaceSearch(() => resources, notes)

    const startedAt = performance.now()
    const broad = await search.gateway.search('archive')
    expect(performance.now() - startedAt).toBeLessThan(1_000)
    expect(broad.status).toBe('complete')
    expect(broad.results).toHaveLength(50)
    await expect(search.gateway.search('rés')).resolves.toMatchObject({
      status: 'complete',
      results: [{ match: { type: 'title' } }, { match: { type: 'title' } }],
    })
    expect(get).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    search.dispose()
  })

  it('uses the live search budget for broad body-only matches', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const version = initialVersion(await sha256Digest(new TextEncoder().encode('resource')))
    const resources: ReadonlyArray<ResourceRecord> = Array.from({ length: 65 }, (_, index) => ({
      id: generateDomainId(DOMAIN_ID_KIND.resource),
      campaignId,
      parentId: null,
      kind: 'note' as const,
      title: canonicalizeResourceTitle(`Journal ${index.toString().padStart(2, '0')}`),
      icon: null,
      color: null,
      lifecycle: { state: 'active' as const },
      metadataVersion: version,
      created: { at: 1, by: actorId },
      updated: { at: 1, by: actorId },
    }))
    const document = noteBlocksToYDoc(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Shared archive' }] }],
      NOTE_YJS_FRAGMENT,
    )
    const session = createInMemoryNoteSession(document, version)
    const get = vi.fn((): NoteSessionState => ({ status: 'ready', session }))
    const subscribe = vi.fn(() => () => undefined)
    const notes: NoteSessionSource = {
      get,
      subscribe,
      export: () => ({ status: 'unavailable', reason: 'capability_not_supported' }),
      create: () =>
        Promise.resolve({ status: 'not_committed', retryable: false, reason: 'invalid_response' }),
      dispose: () => undefined,
    }
    const search = createInMemoryWorkspaceSearch(() => resources, notes)

    await expect(search.gateway.search('archive')).resolves.toEqual({
      status: 'incomplete',
      results: [],
    })
    expect(get).toHaveBeenCalledTimes(65)
    expect(subscribe).not.toHaveBeenCalled()

    search.dispose()
    session.dispose()
  })
})
