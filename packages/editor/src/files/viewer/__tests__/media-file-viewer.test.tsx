import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { AudioFileViewer } from '../audio-file-viewer'
import { VideoFileViewer } from '../video-file-viewer'

describe('media file viewers', () => {
  it('renders caller-provided audio captions as the media track', () => {
    render(
      <AudioFileViewer
        audioUrl="https://example.com/audio.mp3"
        captions={{ src: 'https://example.com/audio.vtt', srcLang: 'en', label: 'English' }}
      />,
    )

    expectCaptionsTrack('English', 'https://example.com/audio.vtt')
  })

  it('renders caller-provided video captions as the media track', () => {
    render(
      <VideoFileViewer
        videoUrl="https://example.com/video.mp4"
        captions={{ src: 'https://example.com/video.vtt', srcLang: 'en', label: 'English' }}
      />,
    )

    expectCaptionsTrack('English', 'https://example.com/video.vtt')
  })

  it('renders an explicit unavailable captions state when audio has no captions source', () => {
    render(<AudioFileViewer audioUrl="https://example.com/audio.mp3" />)

    expectCaptionsTrack(
      'Captions unavailable',
      expect.stringContaining('Captions%20are%20not%20available'),
    )
    expect(screen.getByText('Captions unavailable')).toBeInTheDocument()
  })

  it('renders an explicit unavailable captions state when video has no captions source', () => {
    render(<VideoFileViewer videoUrl="https://example.com/video.mp4" />)

    expectCaptionsTrack(
      'Captions unavailable',
      expect.stringContaining('Captions%20are%20not%20available'),
    )
    expect(screen.getByText('Captions unavailable')).toBeInTheDocument()
  })

  it('renders invalid media URLs as an alert without a fallback captions state', () => {
    render(
      <VideoFileViewer
        videoUrl="http://example.com/video.mp4"
        captions={{ src: 'https://example.com/video.vtt', srcLang: 'en', label: 'English' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid Video URL')
    expect(document.querySelector('track')).toBeNull()
  })

  it('renders invalid audio URLs as an alert without a fallback captions state', () => {
    render(
      <AudioFileViewer
        audioUrl="http://example.com/audio.mp3"
        captions={{ src: 'https://example.com/audio.vtt', srcLang: 'en', label: 'English' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid Audio URL')
    expect(document.querySelector('track')).toBeNull()
  })

  it('renders audio load failures as an alert', () => {
    render(<AudioFileViewer audioUrl="https://example.com/audio.mp3" />)

    fireEvent.error(document.querySelector('audio')!)

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load audio')
  })

  it('renders video load failures as an alert', () => {
    render(<VideoFileViewer videoUrl="https://example.com/video.mp4" />)

    fireEvent.error(document.querySelector('video')!)

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load video')
  })
})

function expectCaptionsTrack(label: string, src: unknown) {
  const track = document.querySelector(`track[label="${label}"]`)
  expect(track).toHaveAttribute('kind', 'captions')
  expect(track).toHaveAttribute('src', src)
}
