import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import { WorkspaceContextMenuModelSourceProvider } from '../context-menu-model-source'
import type { WorkspaceContextMenuModelSource } from '../context-menu-model-source'
import { useWorkspaceRuntimeContextMenuModel } from './runtime-model'
import type { WorkspaceRuntimeContextMenuModelInput } from './runtime-model'
import type { FileSystemSelection } from '../../filesystem/selection'

export function WorkspaceRuntimeContextMenuSourceProvider({
  children,
  runtime,
  selection,
}: {
  children: ReactNode
  runtime: WorkspaceRuntimeContextMenuModelInput
  selection?: Pick<FileSystemSelection, 'selectedItemIds'>
}) {
  const source = selection
    ? {
        ...runtime,
        filesystem: {
          ...runtime.filesystem,
          selection,
        },
      }
    : runtime

  return (
    <WorkspaceRuntimeContextMenuSourceContext.Provider value={source}>
      <WorkspaceContextMenuModelSourceProvider source={WorkspaceRuntimeContextMenuModelSource}>
        {children}
      </WorkspaceContextMenuModelSourceProvider>
    </WorkspaceRuntimeContextMenuSourceContext.Provider>
  )
}

const WorkspaceRuntimeContextMenuSourceContext =
  createContext<WorkspaceRuntimeContextMenuModelInput | null>(null)

const WorkspaceRuntimeContextMenuModelSource = ({
  children,
  options,
}: Parameters<WorkspaceContextMenuModelSource>[0]) => {
  const runtime = use(WorkspaceRuntimeContextMenuSourceContext)
  if (!runtime) {
    throw new Error(
      'WorkspaceRuntimeContextMenuSourceProvider requires a workspace runtime context',
    )
  }
  const { dialogs, model } = useWorkspaceRuntimeContextMenuModel(options, runtime)
  return (
    <>
      {children(model)}
      {dialogs}
    </>
  )
}
