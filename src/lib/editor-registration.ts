import { registerDefaults } from './editor-registry'
import { PageLayoutViewer } from '~/components/notes-page/viewer/page-layout-viewer'
import { MapViewer } from '~/components/notes-page/viewer/map-viewer'
import { FolderViewer } from '~/components/notes-page/viewer/folder-viewer'
import { CategoryViewer } from '~/components/notes-page/viewer/category-viewer'

export function initializeEditorRegistry() {
  registerDefaults({
    notes: {
      component: PageLayoutViewer,
    },
    tags: {
      component: PageLayoutViewer,
    },
    gameMaps: {
      component: MapViewer,
    },
    folders: {
      component: FolderViewer,
    },
    tagCategories: {
      component: CategoryViewer,
    },
  })
}
