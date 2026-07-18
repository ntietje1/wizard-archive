import { Migrations } from '@convex-dev/migrations'
import {
  canvasAuthoredDestinations,
  parseCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import { noteAuthoredDestinations } from '@wizard-archive/editor/notes/authored-destinations'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import * as Y from 'yjs'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { loadValidMapContentRows } from './resources/functions/mapContent'
import { replaceResourceReferenceProjection } from './resources/functions/resourceReferences'

const migrations = new Migrations<DataModel>(components.migrations)

export const projectNoteReferences = migrations.define({
  table: 'resourceNoteContents',
  batchSize: 1,
  migrateOne: async (ctx, content) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, content.resourceUuid)
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, content.campaignUuid)
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update: content.update }], NOTE_YJS_FRAGMENT)
    if (
      (
        await replaceResourceReferenceProjection(ctx, {
          campaignId,
          sourceResourceId: resourceId,
          sourceVersion: assertVersionStamp(content.version),
          destinations: noteAuthoredDestinations(blocks),
        })
      ).status !== 'completed'
    ) {
      throw new RangeError('Note reference projection exceeds its bound')
    }
  },
})

export const projectCanvasReferences = migrations.define({
  table: 'resourceCanvasContents',
  batchSize: 1,
  migrateOne: async (ctx, content) => {
    const document = new Y.Doc()
    try {
      Y.applyUpdate(document, new Uint8Array(content.update))
      const parsed = parseCanvasDocumentContent(document)
      if (!parsed) throw new TypeError('Canvas content is corrupt')
      if (
        (
          await replaceResourceReferenceProjection(ctx, {
            campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, content.campaignUuid),
            sourceResourceId: assertDomainId(DOMAIN_ID_KIND.resource, content.resourceUuid),
            sourceVersion: assertVersionStamp(content.version),
            destinations: canvasAuthoredDestinations(parsed.nodes),
          })
        ).status !== 'completed'
      ) {
        throw new RangeError('Canvas reference projection exceeds its bound')
      }
    } finally {
      document.destroy()
    }
  },
})

export const projectMapReferences = migrations.define({
  table: 'resourceMapContents',
  batchSize: 1,
  migrateOne: async (ctx, content) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, content.resourceUuid)
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, content.campaignUuid)
    const rows = await loadValidMapContentRows(ctx.db, resourceId, campaignId)
    if (rows.status !== 'ready') throw new TypeError('Map content is corrupt')
    if (
      (
        await replaceResourceReferenceProjection(ctx, {
          campaignId,
          sourceResourceId: resourceId,
          sourceVersion: assertVersionStamp(content.version),
          destinations: rows.projected.pins.map((pin) => pin.destination),
        })
      ).status !== 'completed'
    ) {
      throw new RangeError('Map reference projection exceeds its bound')
    }
  },
})

export const projectResourceReferences = migrations.runner([
  internal.migrations.projectNoteReferences,
  internal.migrations.projectCanvasReferences,
  internal.migrations.projectMapReferences,
])
