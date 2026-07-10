import * as Y from 'yjs'
import { readCanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { ResourceByKind } from '@wizard-archive/editor/resources/resource-contract'
import type { CampaignQueryCtx } from '../../functions'
import type {
  CanvasDownloadContent,
  DownloadItem,
} from '../../sidebarItems/functions/downloadTypes'

type CanvasResource = ResourceByKind<typeof RESOURCE_TYPES.canvases>

export async function getCanvasForDownload(
  ctx: CampaignQueryCtx,
  item: CanvasResource,
  path: string,
): Promise<DownloadItem> {
  return {
    type: RESOURCE_TYPES.canvases,
    name: item.name,
    path: ensureCanvasJsonPath(path),
    content: await readCanvasContentFromYjsUpdates(ctx, item.id),
  }
}

async function readCanvasContentFromYjsUpdates(
  ctx: CampaignQueryCtx,
  canvasId: CanvasResource['id'],
): Promise<CanvasDownloadContent> {
  const rows = ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', canvasId))
    .order('asc')
  const doc = new Y.Doc()
  for await (const row of rows) {
    Y.applyUpdate(doc, new Uint8Array(row.update))
  }
  return readCanvasDocumentContent(doc)
}

function ensureCanvasJsonPath(path: string) {
  return path.endsWith('.canvas.json') ? path : `${path}.canvas.json`
}
