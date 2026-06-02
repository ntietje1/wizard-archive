import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import {
  createCanvasViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { api } from '../../_generated/api'
import { SNAPSHOT_TYPE } from '../../../shared/document-snapshots/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { makeYjsUpdate, makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import type { CustomPartialBlock } from '../../../shared/editor-blocks/types'

describe('note snapshots capture Y.Doc state directly', () => {
  const t = createTestContext()

  it('snapshot captures Y.Doc state directly, not stale blocks table', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Content Test Note',
        parentTarget: { kind: 'direct', parentId: null },
      })

      const blocks: Array<CustomPartialBlock> = [
        {
          id: 'block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
          props: {},
          children: [],
        },
      ]
      const yjsUpdate = makeYjsUpdateWithBlocks(blocks)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: yjsUpdate,
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const snapshot = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .first()
      })

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)

      const doc = new Y.Doc()
      Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
      const fragment = doc.getXmlFragment('document')
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(fragment.toString()).toContain('Hello world')
      doc.destroy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('canvas snapshot uses yjs_state format', () => {
  const t = createTestContext()

  it('pushUpdate on canvas should create yjs_state snapshot, not blocks', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Test Canvas',
        parentTarget: { kind: 'direct', parentId: null },
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: canvasId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', canvasId))
          .first()

        expect(snapshot).not.toBeNull()
        expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
        expect(snapshot!.itemType).toBe(SIDEBAR_ITEM_TYPES.canvases)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Note snapshots use yjs_state format', () => {
  const t = createTestContext()

  it('note snapshot should use yjs_state type', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Snapshot Type Check',
        parentTarget: { kind: 'direct', parentId: null },
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .first()

        expect(snapshot).not.toBeNull()
        expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)

        const doc = new Y.Doc()
        Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
        doc.destroy()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
