import type {
  ContextMenuCommand,
  EditorContextMenuActions,
  EditorContextMenuServices,
  EditorMenuContext,
} from '../types'

export function createActionCommand(
  id: string,
  run: (actions: EditorContextMenuActions, context: EditorMenuContext) => void,
): ContextMenuCommand<EditorMenuContext, EditorContextMenuServices> {
  return {
    id,
    run: (context, services) => run(services.actions, context),
  }
}
