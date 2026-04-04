import { ImageOff } from 'lucide-react'

export function EmbedMapContent({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}
