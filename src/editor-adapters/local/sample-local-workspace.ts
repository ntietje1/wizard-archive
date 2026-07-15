import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import { noteBlocksToYDoc, NOTE_YJS_FRAGMENT } from '@wizard-archive/editor/notes/document-yjs'
import {
  assertSha256Digest,
  initialVersion,
} from '@wizard-archive/editor/resources/component-version'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import {
  FILE_CLASSIFICATION,
  FILE_VIEWER_UNAVAILABLE_REASON,
} from '@wizard-archive/editor/resources/file-content-contract'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'

const SAMPLE_CAMPAIGN_ID = assertDomainId(
  DOMAIN_ID_KIND.campaign,
  '01980c1a-5e70-7000-8000-000000000301',
)
const SAMPLE_ACTOR_ID = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01980c1a-5e70-7000-8000-000000000302',
)
const SAMPLE_VERSION = initialVersion(
  assertSha256Digest('b0d997ebc2fa80098fb4100293402befc37f14939570df1ca07d4278707f4c16'),
)
const SAMPLE_TIMESTAMP = 1_704_067_200_000

export const SAMPLE_LOCAL_RESOURCE_IDS = {
  marketNote: assertDomainId(DOMAIN_ID_KIND.resource, '01980c1a-5e70-7000-8000-000000000401'),
  heistCanvas: assertDomainId(DOMAIN_ID_KIND.resource, '01980c1a-5e70-7000-8000-000000000402'),
  docksMap: assertDomainId(DOMAIN_ID_KIND.resource, '01980c1a-5e70-7000-8000-000000000403'),
  invoiceFile: assertDomainId(DOMAIN_ID_KIND.resource, '01980c1a-5e70-7000-8000-000000000404'),
} as const

const SAMPLE_MAP_PIN_IDS = {
  market: assertDomainId(DOMAIN_ID_KIND.mapPin, '01980c1a-5e70-7000-8000-000000000501'),
  invoice: assertDomainId(DOMAIN_ID_KIND.mapPin, '01980c1a-5e70-7000-8000-000000000502'),
} as const

export const SAMPLE_NOTE_BODY = [
  'A waterfront bazaar where every stall hides a second ledger.',
  '',
  '- Ask Mara about the blue-glass shipment.',
  '- The bell tower guard changes posts after the third tide bell.',
  '- Players know the public auction starts at dusk.',
].join('\n')

const SAMPLE_FILE_BYTES = new TextEncoder().encode(
  'Invoice BG-17\nBlue-glass shipment\nDock fee: 45 silver\nBalance due at third tide bell\n',
)

export function createSampleLocalWorkspaceFixture({
  noteBody = SAMPLE_NOTE_BODY,
  projection = 'dm',
}: {
  noteBody?: string
  projection?: 'dm' | 'player'
} = {}): LocalWorkspaceFixture {
  return {
    scope: {
      campaignId: SAMPLE_CAMPAIGN_ID,
      actorId: SAMPLE_ACTOR_ID,
      projection,
      schema: RESOURCE_INDEX_SCHEMA,
    },
    snapshot: {
      campaignId: SAMPLE_CAMPAIGN_ID,
      resources: sampleResources(),
      tombstones: [],
      aliases: [],
      assetsFolderId: null,
    },
    content: {
      notes: [
        {
          resourceId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
          content: noteDocument(noteBody),
          version: SAMPLE_VERSION,
        },
      ],
      canvases: [
        {
          resourceId: SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas,
          content: sampleCanvasDocument(),
          version: SAMPLE_VERSION,
        },
      ],
      maps: [
        {
          resourceId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
          content: {
            imageAssetId: null,
            layers: [{ id: 'docks', imageAssetId: null, name: 'Moonwell Docks' }],
            pins: [
              {
                id: SAMPLE_MAP_PIN_IDS.market,
                destination: {
                  kind: 'internal',
                  target: { kind: 'resource', resourceId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote },
                },
                layerId: 'docks',
                x: 20,
                y: 25,
                visible: true,
              },
              {
                id: SAMPLE_MAP_PIN_IDS.invoice,
                destination: {
                  kind: 'internal',
                  target: { kind: 'resource', resourceId: SAMPLE_LOCAL_RESOURCE_IDS.invoiceFile },
                },
                layerId: 'docks',
                x: 53,
                y: 23,
                visible: true,
              },
            ],
          },
          version: SAMPLE_VERSION,
        },
      ],
      files: [
        {
          resourceId: SAMPLE_LOCAL_RESOURCE_IDS.invoiceFile,
          bytes: SAMPLE_FILE_BYTES,
          content: {
            assetId: null,
            byteSize: SAMPLE_FILE_BYTES.byteLength,
            classification: FILE_CLASSIFICATION.inert,
            detectedFormat: null,
            extension: 'txt',
            mediaType: 'text/plain',
            viewerUnavailableReason: FILE_VIEWER_UNAVAILABLE_REASON.unsupportedFormat,
          },
          version: SAMPLE_VERSION,
        },
      ],
    },
  }
}

function sampleResources(): Array<ResourceRecord> {
  return [
    resourceRecord(SAMPLE_LOCAL_RESOURCE_IDS.marketNote, 'note', 'The Lantern Market'),
    resourceRecord(SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas, 'canvas', 'Harbor Heist Board'),
    resourceRecord(SAMPLE_LOCAL_RESOURCE_IDS.docksMap, 'map', 'Moonwell Docks'),
    resourceRecord(SAMPLE_LOCAL_RESOURCE_IDS.invoiceFile, 'file', 'Blue-glass Invoice'),
  ]
}

function resourceRecord(
  id: ResourceRecord['id'],
  kind: ResourceRecord['kind'],
  title: string,
): ResourceRecord {
  return {
    id,
    campaignId: SAMPLE_CAMPAIGN_ID,
    parentId: null,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle: { state: 'active' },
    metadataVersion: SAMPLE_VERSION,
    created: { at: SAMPLE_TIMESTAMP, by: SAMPLE_ACTOR_ID },
    updated: { at: SAMPLE_TIMESTAMP, by: SAMPLE_ACTOR_ID },
  }
}

function noteDocument(body: string) {
  return noteBlocksToYDoc(
    body.split(/\n\s*\n/).map((text) => ({
      id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text }],
    })),
    NOTE_YJS_FRAGMENT,
  )
}

function sampleCanvasDocument() {
  const briefId = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01980c1a-5e70-7000-8000-000000000201')
  const mapId = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01980c1a-5e70-7000-8000-000000000202')
  return createCanvasDocumentDoc({
    nodes: [
      { id: briefId, type: 'text', position: { x: 40, y: 40 }, data: {} },
      {
        id: mapId,
        type: 'embed',
        position: { x: 480, y: 56 },
        data: {
          destination: {
            kind: 'internal',
            target: { kind: 'resource', resourceId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap },
          },
        },
      },
    ],
    edges: [{ id: 'brief-to-map', source: briefId, target: mapId, type: 'bezier' }],
  })
}
