import { describe, expect, it } from 'vite-plus/test'
import {
  EMBED_NODE_MIN_SIZE,
  resolveDefaultEmbedNodeResizeForLockedAspectRatio,
  resolveEmbedNodeDefaultSize,
} from '../embed-node-size'

describe('embed node default sizing', () => {
  it('resizes the old default embed box to fit a locked aspect ratio', () => {
    const position = { x: 10, y: 20 }
    expect(
      resolveDefaultEmbedNodeResizeForLockedAspectRatio({ position, width: 320, height: 240 }, 2),
    ).toEqual({ position: { x: 10, y: 20 }, width: 320, height: 160 })
    expect(
      resolveDefaultEmbedNodeResizeForLockedAspectRatio({ position, width: 320, height: 240 }, 2)
        ?.position,
    ).not.toBe(position)
    expect(
      resolveDefaultEmbedNodeResizeForLockedAspectRatio(
        { position: { x: 10, y: 20 }, width: 320, height: 240 },
        0.5,
      ),
    ).toEqual({ position: { x: 10, y: 20 }, width: 120, height: 240 })
  })

  it('leaves user-sized embeds alone', () => {
    expect(
      resolveDefaultEmbedNodeResizeForLockedAspectRatio(
        { position: { x: 10, y: 20 }, width: 200, height: 200 },
        2,
      ),
    ).toBeNull()
  })

  it('leaves invalid or boundary locked-ratio embeds alone', () => {
    for (const lockedAspectRatio of [null, 0, -1, 1e-6, 1e6]) {
      expect(
        resolveDefaultEmbedNodeResizeForLockedAspectRatio(
          { position: { x: 10, y: 20 }, width: 320, height: 240 },
          lockedAspectRatio,
        ),
      ).toBeNull()
    }
  })

  it('does not auto-fit default embeds below the embed minimum size', () => {
    expect(resolveEmbedNodeDefaultSize(0.4)).toEqual({
      width: EMBED_NODE_MIN_SIZE.width,
      height: 240,
    })
    expect(resolveEmbedNodeDefaultSize(320 / EMBED_NODE_MIN_SIZE.height)).toEqual({
      width: 320,
      height: EMBED_NODE_MIN_SIZE.height,
    })
    expect(resolveEmbedNodeDefaultSize(0.39)).toEqual({ width: 320, height: 240 })
    expect(resolveEmbedNodeDefaultSize(4.45)).toEqual({ width: 320, height: 240 })
  })
})
