import { v } from 'convex/values'

const historyPreviewImageUrlStateValidator = v.union(
  v.object({ status: v.literal('idle') }),
  v.object({ status: v.literal('error') }),
  v.object({ status: v.literal('ready'), url: v.string() }),
)

const gameMapSnapshotDataValidator = v.object({
  imageAssetId: v.nullable(v.string()),
  layers: v.optional(
    v.array(
      v.object({
        id: v.string(),
        imageAssetId: v.nullable(v.string()),
        name: v.string(),
      }),
    ),
  ),
  pins: v.array(
    v.object({
      id: v.string(),
      itemId: v.string(),
      layerId: v.optional(v.nullable(v.string())),
      x: v.number(),
      y: v.number(),
      visible: v.boolean(),
      name: v.nullable(v.string()),
      color: v.nullable(v.string()),
      iconName: v.nullable(v.string()),
      itemType: v.nullable(v.string()),
    }),
  ),
})

export const historyPreviewValidator = v.union(
  v.object({ kind: v.literal('note-yjs'), noteId: v.string(), data: v.bytes() }),
  v.object({ kind: v.literal('canvas-yjs'), canvasId: v.string(), data: v.bytes() }),
  v.object({
    kind: v.literal('game-map'),
    snapshotData: gameMapSnapshotDataValidator,
    imageUrlState: historyPreviewImageUrlStateValidator,
  }),
  v.object({ kind: v.literal('unsupported') }),
)
