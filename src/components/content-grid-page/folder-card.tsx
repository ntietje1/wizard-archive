import { Card, CardHeader, CardTitle } from '~/components/shadcn/ui/card'
import { Folder, FolderDot } from '~/lib/icons'

interface FolderCardProps {
  name: string
  hasContent?: boolean
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export function FolderCard({
  name,
  hasContent = false,
  onClick,
  className = '',
}: FolderCardProps) {
  const FolderIcon = hasContent ? FolderDot : Folder

  return (
    <div className={`relative group ${className}`}>
      <Card
        className="hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-amber-300 w-full h-full cursor-pointer"
        onClick={onClick}
      >
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <FolderIcon className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle className="text-lg text-slate-800 group-hover:text-amber-700 transition-colors line-clamp-1">
              {name || 'Untitled Folder'}
            </CardTitle>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
