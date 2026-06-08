import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '~/features/embeds/utils/embed-media'
import type { EmbedMediaLayout } from '~/features/embeds/utils/embed-media'

interface MockEmbedContentProps {
  target: { kind: string; url?: string; name?: string }
  mode: 'editable' | 'readonly'
  onUpload?: () => void
  onLinkExternal?: () => void
  onMediaLayout?: (layout: EmbedMediaLayout) => void
  allowInnerScroll?: boolean
}

export function makeMockEmbedContent() {
  return function MockEmbedContent(props: MockEmbedContentProps) {
    return (
      <div>
        <div
          data-testid="shared-embed-content"
          data-kind={props.target.kind}
          data-mode={props.mode}
          data-allow-inner-scroll={props.allowInnerScroll ? 'true' : 'false'}
        >
          {props.target.name ?? props.target.url ?? props.target.kind}
        </div>
        <input type="range" aria-label="mock media slider" data-embed-media-control="true" />
        {props.onUpload ? <button onClick={props.onUpload}>mock upload</button> : null}
        {props.onLinkExternal ? <button onClick={props.onLinkExternal}>mock link</button> : null}
        {props.onMediaLayout ? (
          <>
            <button
              onClick={() =>
                props.onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio: 16 / 9 })
              }
            >
              mock aspect ratio
            </button>
            <button
              onClick={() =>
                props.onMediaLayout?.({
                  kind: 'fixedHeight',
                  height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
                })
              }
            >
              mock audio layout
            </button>
          </>
        ) : null}
      </div>
    )
  }
}
