import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { inspectLocalMapImage } from '../local-map-image-inspection'

describe('local map image inspection', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses the browser decoder to produce canonical classifier evidence', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'ImageDecoder',
      class {
        static isTypeSupported = () => Promise.resolve(true)
        readonly tracks = {
          ready: Promise.resolve(),
          selectedTrack: { frameCount: 2 },
        }
        close = close
        decode = () =>
          Promise.resolve({
            image: {
              codedHeight: 3,
              codedWidth: 2,
              close: vi.fn(),
              displayHeight: 3,
              displayWidth: 2,
            },
          })
      },
    )

    await expect(
      inspectLocalMapImage({
        bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        fileName: 'map.png',
      }),
    ).resolves.toEqual({
      status: 'valid',
      format: 'png',
      width: 2,
      height: 3,
      frameCount: 2,
      totalDecodedPixels: 12,
      canonicalOrientation: true,
    })
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes browser decode work at the inspection deadline', async () => {
    vi.useFakeTimers()
    let rejectReady!: (reason: Error) => void
    const close = vi.fn(() => rejectReady(new Error('closed')))
    vi.stubGlobal(
      'ImageDecoder',
      class {
        static isTypeSupported = () => Promise.resolve(true)
        readonly tracks = {
          ready: new Promise<void>((_resolve, reject) => (rejectReady = reject)),
          selectedTrack: null,
        }
        close = close
        decode = vi.fn()
      },
    )
    const inspection = inspectLocalMapImage({
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fileName: 'map.png',
    })

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(inspection).resolves.toEqual({
      status: 'unavailable',
      reason: 'parser_timeout',
    })
    expect(close).toHaveBeenCalled()
  })
})
