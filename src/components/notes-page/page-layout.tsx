import { FileTopbar } from './editor/file-topbar/topbar'

export function EditorPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <FileTopbar />
      {children}
    </div>
  )
}

