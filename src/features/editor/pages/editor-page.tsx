import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'

export function EditorPage() {
  useSelectedItemSync()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <EditorContent />
    </div>
  )
}
