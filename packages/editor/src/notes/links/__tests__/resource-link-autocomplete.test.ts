import { describe, expect, it } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '../../../resources/component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import type { ResourceNavigation } from '../../../resources/editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../../../resources/in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../../../resources/resource-index-contract'
import { canonicalizeResourceTitle } from '../../../resources/resource-record'
import type { ResourceRecord } from '../../../resources/resource-record'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../document/headless-yjs'
import { resourceLinkInlineContent, resourceLinkSuggestions } from '../resource-link-autocomplete'
import { parseSerializedAuthoredDestination } from '../../../resources/authored-destination'

describe('resource link autocomplete', () => {
  it('keeps duplicate titles as separate exact resource suggestions', async () => {
    const fixture = await runtimeFixture()

    await expect(
      resourceLinkSuggestions(fixture.core.runtime, fixture.source.id, 'Rules'),
    ).resolves.toEqual([])
    await expect(
      resourceLinkSuggestions(fixture.core.runtime, fixture.source.id, '['),
    ).resolves.toHaveLength(3)
    const suggestions = await resourceLinkSuggestions(
      fixture.core.runtime,
      fixture.source.id,
      '[Rules',
    )

    expect(new Set(suggestions.map(({ key }) => key))).toEqual(
      new Set([fixture.note.id, fixture.map.id]),
    )
    expect(new Set(suggestions.map(({ target }) => target.resourceId))).toEqual(
      new Set([fixture.note.id, fixture.map.id]),
    )
    expect(suggestions.every(({ target }) => target.kind === 'resource')).toBe(true)
    expect(suggestions.every(({ label }) => label === 'Rules')).toBe(true)
    fixture.core.dispose()
  })

  it('authors headings as exact note-block targets, including the current note shorthand', async () => {
    const fixture = await runtimeFixture()

    const suggestions = await resourceLinkSuggestions(
      fixture.core.runtime,
      fixture.source.id,
      '[#Combat#actions',
    )

    expect(suggestions).toMatchObject([
      {
        label: 'Source › Combat actions',
        target: {
          kind: 'noteBlock',
          resourceId: fixture.source.id,
          blockId: fixture.headingId,
          presentation: 'heading',
        },
      },
    ])
    fixture.core.dispose()
  })

  it('builds one atomic inline destination from the selected exact result', async () => {
    const fixture = await runtimeFixture()
    const suggestions = await resourceLinkSuggestions(
      fixture.core.runtime,
      fixture.source.id,
      '[Rules',
    )
    const suggestion = suggestions.find(({ resource }) => resource.id === fixture.note.id)
    if (!suggestion) throw new Error('Expected the note suggestion')

    const inline = resourceLinkInlineContent(suggestion)
    expect(inline.type).toBe('resourceLink')
    expect(inline.props.label).toBe('Rules')
    expect(parseSerializedAuthoredDestination(inline.props.destination)).toEqual({
      kind: 'internal',
      target: { kind: 'resource', resourceId: fixture.note.id },
    })
    fixture.core.dispose()
  })
})

async function runtimeFixture() {
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const source = await createResourceRecord(campaignId, actorId, 'Source', 'note')
  const note = await createResourceRecord(campaignId, actorId, 'Rules', 'note')
  const map = await createResourceRecord(campaignId, actorId, 'Rules', 'map')
  const headingId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
  const sourceDocument = noteBlocksToYDoc(
    [
      {
        id: headingId,
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Combat actions' }],
      },
    ],
    NOTE_YJS_FRAGMENT,
  )
  const noteDocument = noteBlocksToYDoc(
    [{ type: 'paragraph', content: [{ type: 'text', text: 'Rules reference' }] }],
    NOTE_YJS_FRAGMENT,
  )
  const core = createInMemoryEditorRuntime({
    scope: {
      campaignId,
      actorId,
      projection: 'dm',
      schema: RESOURCE_INDEX_SCHEMA,
    },
    snapshot: {
      campaignId,
      resources: [source, note, map],
      tombstones: [],
      aliases: [],
      assetsFolderId: null,
    },
    content: {
      notes: [
        { resourceId: source.id, content: sourceDocument, version: source.metadataVersion },
        { resourceId: note.id, content: noteDocument, version: note.metadataVersion },
      ],
    },
    navigation,
  })
  return { core, headingId, map, note, source }
}

async function createResourceRecord(
  campaignId: ResourceRecord['campaignId'],
  actorId: ResourceRecord['created']['by'],
  title: string,
  kind: ResourceRecord['kind'],
): Promise<ResourceRecord> {
  const id = generateDomainId(DOMAIN_ID_KIND.resource)
  const metadataVersion = initialVersion(
    await sha256Digest(new TextEncoder().encode(`${kind}:${id}`)),
  )
  return {
    id,
    campaignId,
    parentId: null,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle: { state: 'active' },
    metadataVersion,
    created: { at: 1, by: actorId },
    updated: { at: 1, by: actorId },
  }
}

const navigation: ResourceNavigation = {
  current: () => null,
  open: () => undefined,
  subscribe: () => () => undefined,
}
