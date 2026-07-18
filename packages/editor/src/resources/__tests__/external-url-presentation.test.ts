import { describe, expect, it } from 'vite-plus/test'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import { presentExternalUrl } from '../external-url-presentation'

describe('external URL presentation', () => {
  it.each([
    ['https://example.com/image.png?download=1#preview', 'image.png', 'image'],
    ['https://example.com/audio.mp3?source=embed', 'audio.mp3', 'audio'],
    ['https://example.com/video.webm#time=10', 'video.webm', 'video'],
    ['https://example.com/document.pdf?download=0#page=3', 'document.pdf', 'pdf'],
    ['https://example.com/archive.bin?download=1#details', 'archive.bin', 'file'],
  ] as const)('presents %s as %s without query or fragment data', (input, title, mediaKind) => {
    const url = safeUrl(input)

    expect(presentExternalUrl(url)).toEqual({ href: url, mediaKind, title })
  })

  it.each([
    ['https://example.com/bad%', 'bad%'],
    ['https://example.com/truncated%E0%A4%A', 'truncated%E0%A4%A'],
    ['https://example.com/folder%2Fdocument.pdf', 'folder/document.pdf'],
    ['https://example.com/', 'example.com'],
    ['https://example.com/資料/地図.png', '地図.png'],
  ] as const)('derives a no-throw title for %s', (input, title) => {
    const url = safeUrl(input)

    expect(() => presentExternalUrl(url)).not.toThrow()
    expect(presentExternalUrl(url)).toMatchObject({ href: url, title })
  })
})

function safeUrl(input: string) {
  const url = parseSafeHttpsUrl(input)
  if (!url) throw new Error(`Expected a safe HTTPS URL: ${input}`)
  return url
}
