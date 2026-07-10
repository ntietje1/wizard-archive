import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ExternalUrlEmbedContent } from '../external-url-embed-content'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '../../utils/media'

type ResizeObserverEntryInput = {
  target: Element
  contentRect: DOMRectReadOnly
}

vi.mock('../../../files/viewer/pdf-embed-renderer', () => ({
  PdfEmbedRenderer: ({
    pdfUrl,
    onFirstPageAspectRatio,
    presentation,
    allowInnerScroll,
  }: {
    pdfUrl: string
    presentation?: 'full' | 'embed'
    allowInnerScroll?: boolean
    onFirstPageAspectRatio?: (aspectRatio: number | null) => void
  }) => (
    <button
      type="button"
      data-testid="pdf-viewer"
      data-url={pdfUrl}
      data-presentation={presentation}
      data-allow-inner-scroll={allowInnerScroll === false ? 'false' : 'true'}
      onClick={() => onFirstPageAspectRatio?.(0.75)}
    >
      report pdf ratio
    </button>
  ),
}))

describe('ExternalUrlEmbedContent', () => {
  it('renders images inline', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/a.png" name="a.png" />)

    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute(
      'src',
      'https://x.test/a.png',
    )
    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute('draggable', 'false')
  })

  it('reports external image intrinsic aspect ratios', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/a.png"
        name="a.png"
        onMediaLayout={onMediaLayout}
      />,
    )

    const image = screen.getByRole('img', { name: 'a.png' })
    Object.defineProperty(image, 'naturalWidth', { value: 1600 })
    Object.defineProperty(image, 'naturalHeight', { value: 900 })
    fireEvent.load(image)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.777778,
    })
  })

  it('renders video and audio urls with custom media controls', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />,
    )
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://x.test/movie.mp4')
    expect(document.querySelector('video')).toHaveAttribute('draggable', 'false')
    expect(screen.getByRole('button', { name: 'Play movie.mp4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument()

    rerender(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)
    expect(document.querySelector('audio')).toHaveAttribute('src', 'https://x.test/sound.mp3')
    expect(document.querySelector('audio')).toHaveAttribute('draggable', 'false')
    expect(screen.getByRole('button', { name: 'Play sound.mp3' })).toBeInTheDocument()
  })

  it('only plays videos from the custom play button', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined)
    const onPointerDown = vi.fn()
    render(
      <div onPointerDown={onPointerDown}>
        <ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />
      </div>,
    )

    fireEvent.pointerDown(screen.getByTestId('video-embed-player'))
    expect(onPointerDown).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Play movie.mp4' }))

    expect(play).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Pause movie.mp4' }))

    expect(pause).toHaveBeenCalledTimes(1)
    play.mockRestore()
    pause.mockRestore()
  })

  it('returns to paused controls when media playback is rejected', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('denied'))

    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)

    await user.click(screen.getByRole('button', { name: 'Play movie.mp4' }))

    expect(await screen.findByRole('button', { name: 'Play movie.mp4' })).toBeInTheDocument()
    play.mockRestore()
  })

  it('requests fullscreen from the custom video fullscreen button', async () => {
    const user = userEvent.setup()
    const requestFullscreen = vi.fn()
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    Object.defineProperty(screen.getByTestId('video-embed-player'), 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })

    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }))

    expect(requestFullscreen).toHaveBeenCalled()
  })

  it('prevents native image and media-control drags without blocking media surfaces', () => {
    const { rerender } = render(<ExternalUrlEmbedContent url="https://x.test/a.png" name="a.png" />)
    expect(fireEvent.dragStart(screen.getByRole('img', { name: 'a.png' }))).toBe(false)

    rerender(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    expect(fireEvent.dragStart(document.querySelector('video')!)).toBe(true)
    expect(fireEvent.dragStart(screen.getByRole('button', { name: 'Play movie.mp4' }))).toBe(false)

    rerender(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)
    expect(fireEvent.dragStart(screen.getByTestId('audio-embed-player'))).toBe(true)
    expect(fireEvent.dragStart(screen.getByRole('button', { name: 'Play sound.mp3' }))).toBe(false)
  })

  it('reports audio as a fixed-height layout', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/sound.mp3"
        name="sound.mp3"
        onMediaLayout={onMediaLayout}
      />,
    )

    expect(screen.getByTestId('audio-embed-player').style.height).toBe('')
    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'fixedHeight',
      height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
    })
  })

  it('updates audio fixed-height layout from the rendered custom control height', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/sound.mp3"
        name="sound.mp3"
        onMediaLayout={onMediaLayout}
      />,
    )

    const audio = document.querySelector('audio')
    vi.spyOn(screen.getByTestId('audio-embed-player'), 'getBoundingClientRect').mockReturnValue({
      bottom: 37,
      height: 37,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.loadedMetadata(audio!)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'fixedHeight',
      height: 37,
    })
  })

  it('uses custom audio controls without blocking block-surface pointer events', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const onPointerDown = vi.fn()
    render(
      <div onPointerDown={onPointerDown}>
        <ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />
      </div>,
    )

    fireEvent.pointerDown(screen.getByTestId('audio-embed-player'))
    expect(onPointerDown).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Play sound.mp3' }))

    expect(play).toHaveBeenCalled()
    expect(screen.getByRole('slider', { name: 'Seek sound.mp3' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume sound.mp3' })).toBeInTheDocument()
    play.mockRestore()
  })

  it('unmutes media when volume is raised from a muted state', async () => {
    const user = userEvent.setup()
    render(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)

    const audio = document.querySelector('audio')!
    await user.click(screen.getByRole('button', { name: 'Mute sound.mp3' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Volume sound.mp3' }), {
      target: { value: '0.5' },
    })

    expect(audio.muted).toBe(false)
    expect(screen.getByRole('button', { name: 'Mute sound.mp3' })).toBeInTheDocument()
  })

  it('keeps the timeline usable and toggles compact volume at narrow widths', async () => {
    const user = userEvent.setup()
    const resizeObserver = installResizeObserverMock()
    try {
      render(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)

      resizeObserver.resize(screen.getByTestId('custom-media-controls'), 180)

      expect(screen.getByRole('slider', { name: 'Seek sound.mp3' })).toBeInTheDocument()

      const volumeButton = screen.getByRole('button', { name: 'Adjust volume sound.mp3' })
      expect(volumeButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(volumeButton)

      expect(volumeButton).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('slider', { name: 'Volume sound.mp3' })).toHaveAttribute(
        'aria-orientation',
        'vertical',
      )

      await user.click(volumeButton)
      expect(volumeButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(volumeButton)
      expect(volumeButton).toHaveAttribute('aria-expanded', 'true')

      fireEvent.mouseLeave(screen.getByTestId('compact-volume-slider'))
      expect(volumeButton).toHaveAttribute('aria-expanded', 'false')
    } finally {
      resizeObserver.restore()
    }
  })

  it('groups trailing media actions with mute and fullscreen controls', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)

    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
    const trailingControls = screen.getByTestId('media-control-trailing-controls')
    expect(trailingControls).toContainElement(
      screen.getByRole('button', { name: 'Mute movie.mp4' }),
    )
    expect(trailingControls).toContainElement(
      screen.getByRole('button', { name: 'Enter fullscreen' }),
    )
  })

  it('updates seek slider hover preview position', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    const seek = screen.getByRole('slider', { name: 'Seek movie.mp4' })
    vi.spyOn(seek, 'getBoundingClientRect').mockReturnValue({
      bottom: 10,
      height: 10,
      left: 10,
      right: 110,
      top: 0,
      width: 100,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(seek, { clientX: 60 })

    expect(seek).toHaveStyle('--media-slider-hover-percent: 50%')
  })

  it('renders PDFs through the React PDF viewer', async () => {
    render(<ExternalUrlEmbedContent url="https://x.test/doc.pdf" name="doc.pdf" />)

    expect(await screen.findByTestId('pdf-viewer')).toHaveAttribute(
      'data-url',
      'https://x.test/doc.pdf',
    )
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-presentation', 'embed')
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-allow-inner-scroll', 'true')
  })

  it('forwards disabled inner scrolling to embedded PDFs', async () => {
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/doc.pdf"
        name="doc.pdf"
        allowInnerScroll={false}
      />,
    )

    expect(await screen.findByTestId('pdf-viewer')).toHaveAttribute(
      'data-allow-inner-scroll',
      'false',
    )
  })

  it('forwards external PDF page aspect ratios', async () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/doc.pdf"
        name="doc.pdf"
        onMediaLayout={onMediaLayout}
      />,
    )

    fireEvent.click(await screen.findByTestId('pdf-viewer'))

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 0.75,
    })
  })

  it('renders unknown external files without nested border chrome', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/download" name="download" />)

    const card = screen.getByTestId('external-url-embed-card')
    expect(card).not.toHaveClass('border')
    expect(card).not.toHaveClass('rounded-md')
    expect(card).not.toHaveClass('bg-muted/30')
    expect(card).not.toHaveClass('p-4')
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://x.test/download',
    )
  })

  it('keeps unsafe external file URLs inert', () => {
    render(<ExternalUrlEmbedContent url="javascript:alert(1)" name="unsafe.js" />)

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('unsafe.js')
    expect(screen.getByRole('status')).toHaveTextContent('Link unavailable')
    expect(screen.queryByText('Open file')).not.toBeInTheDocument()
  })

  it('renders public media domains that start like IPv6 private ranges', () => {
    const { rerender } = render(<ExternalUrlEmbedContent url="https://fcc.gov/a.png" name="fcc" />)

    expect(screen.getByRole('img', { name: 'fcc' })).toHaveAttribute('src', 'https://fcc.gov/a.png')

    rerender(<ExternalUrlEmbedContent url="https://fdic.gov/a.png" name="fdic" />)

    expect(screen.getByRole('img', { name: 'fdic' })).toHaveAttribute(
      'src',
      'https://fdic.gov/a.png',
    )
  })

  it('renders private browser media hosts as file cards', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://[fd00::1]/a.png" name="private-ipv6.png" />,
    )

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('private-ipv6.png')
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://[fd00::1]/a.png',
    )

    rerender(<ExternalUrlEmbedContent url="https://[fe80::1]/a.mp4" name="link-local.mp4" />)

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('link-local.mp4')
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://[fe80::1]/a.mp4',
    )
  })

  it('renders IPv4-mapped and compatible IPv6 media hosts as file cards', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://[::ffff:127.0.0.1]/a.png" name="mapped.png" />,
    )

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('mapped.png')
    expect(screen.queryByRole('img', { name: 'mapped.png' })).not.toBeInTheDocument()

    rerender(<ExternalUrlEmbedContent url="https://[::ffff:7f00:1]/a.png" name="mapped-hex.png" />)

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('mapped-hex.png')
    expect(screen.queryByRole('img', { name: 'mapped-hex.png' })).not.toBeInTheDocument()

    rerender(<ExternalUrlEmbedContent url="https://[::127.0.0.1]/a.mp4" name="compatible.mp4" />)

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('compatible.mp4')
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('renders loopback and wildcard media hosts as file cards', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://127.0.0.2/a.png" name="loopback.png" />,
    )

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('loopback.png')

    rerender(<ExternalUrlEmbedContent url="https://0.0.0.0/a.mp4" name="wildcard.mp4" />)

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('wildcard.mp4')
  })

  it('falls back to an inert file card after image media fails to load', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/missing.png" name="missing.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'missing.png' }))

    expect(screen.getByTestId('external-url-embed-card')).toHaveTextContent('missing.png')
    expect(screen.queryByRole('img', { name: 'missing.png' })).not.toBeInTheDocument()
  })

  it('keeps active resize observations after a sibling media embed unmounts', () => {
    const resizeObserver = installResizeObserverMock()
    function AudioPair({ showFirst }: { showFirst: boolean }) {
      return (
        <>
          {showFirst ? (
            <ExternalUrlEmbedContent url="https://x.test/first.mp3" name="first.mp3" />
          ) : null}
          <ExternalUrlEmbedContent url="https://x.test/second.mp3" name="second.mp3" />
        </>
      )
    }

    try {
      const { rerender } = render(<AudioPair showFirst={true} />)
      const [, secondControls] = screen.getAllByTestId('custom-media-controls')

      resizeObserver.resize(secondControls!, 180)
      expect(screen.getByRole('button', { name: 'Adjust volume second.mp3' })).toHaveAttribute(
        'aria-expanded',
        'false',
      )

      rerender(<AudioPair showFirst={false} />)

      resizeObserver.resize(screen.getByTestId('custom-media-controls'), 180)
      expect(screen.getByRole('button', { name: 'Adjust volume second.mp3' })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    } finally {
      resizeObserver.restore()
    }
  })
})

function installResizeObserverMock() {
  const originalResizeObserver = globalThis.ResizeObserver
  const callbacks = new Map<Element, ResizeObserverCallback>()

  class MockResizeObserver implements ResizeObserver {
    readonly callback: ResizeObserverCallback
    readonly targets = new Set<Element>()

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe = (target: Element) => {
      this.targets.add(target)
      callbacks.set(target, this.callback)
    }

    unobserve = (target: Element) => {
      this.targets.delete(target)
      callbacks.delete(target)
    }

    disconnect = () => {
      for (const target of this.targets) {
        callbacks.delete(target)
      }
      this.targets.clear()
    }
  }

  globalThis.ResizeObserver = MockResizeObserver

  return {
    resize(target: Element, width: number) {
      const callback = callbacks.get(target)
      if (!callback) throw new Error('Expected observed element to have a resize callback')
      const entry: ResizeObserverEntryInput = {
        target,
        contentRect: {
          bottom: 40,
          height: 40,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        },
      }
      act(() => {
        callback([entry as ResizeObserverEntry], {} as ResizeObserver)
      })
    },
    restore() {
      globalThis.ResizeObserver = originalResizeObserver
    },
  }
}
