import { registerDefaults } from './editor-registry'
import { MapViewer } from '~/components/notes-page/viewer/map/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder/folder-viewer'
import { CategoryViewer } from '~/components/notes-page/viewer/category/category-viewer'
import { NoteEditor } from '~/components/notes-page/viewer/note/note-editor'
import { TagEditor } from '~/components/notes-page/viewer/tag/tag-editor'
import { FileViewer } from '~/components/notes-page/viewer/file/file-viewer'

export function initializeEditorRegistry() {
  registerDefaults({
    notes: {
      component: NoteEditor,
      showPageBar: true,
    },
    tags: {
      component: TagEditor,
      showPageBar: true,
    },
    gameMaps: {
      component: MapViewer,
      showPageBar: false,
    },
    folders: {
      component: FolderViewer,
      showPageBar: false,
    },
    tagCategories: {
      component: CategoryViewer,
      showPageBar: false,
    },
    files: {
      component: FileViewer,
      showPageBar: false,
    },
  })
}
