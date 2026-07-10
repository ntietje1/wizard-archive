import { CREATE_PARENT_TARGET_KIND } from './items'
import { useSearchDialogController } from '../search/dialog-controller'
import type { SearchDialogActions, SearchDialogRequestState } from '../search/dialog-controller'
import type { ItemSearchState } from '../search/model'
import type { FileSystemItemCreateOperations } from '../filesystem/item-operation-contracts'
import type { WorkspaceNavigation } from './runtime'

type WorkspaceRuntimeSearchControllerInput = {
  navigation: Pick<WorkspaceNavigation, 'openItem'>
  filesystem: {
    operations: FileSystemItemCreateOperations
  }
}

export function useWorkspaceRuntimeSearchDialogController({
  request,
  runtime,
  searchState,
}: {
  request: SearchDialogRequestState
  runtime: WorkspaceRuntimeSearchControllerInput
  searchState: ItemSearchState
}) {
  return useSearchDialogController({
    actions: createWorkspaceSearchDialogActions(runtime),
    request,
    searchState,
  })
}

function createWorkspaceSearchDialogActions(
  runtime: WorkspaceRuntimeSearchControllerInput,
): SearchDialogActions {
  return {
    createItem: ({ name, parentId, type }) =>
      runtime.filesystem.operations.createItem({
        name,
        type,
        parentTarget: { kind: CREATE_PARENT_TARGET_KIND.direct, parentId },
      }),
    openItem: runtime.navigation.openItem,
  }
}
