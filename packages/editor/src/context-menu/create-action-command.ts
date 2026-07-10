import type { ContextMenuCommand } from './types'

export function createActionCommand<TContext, TActions>(
  id: string,
  run: (actions: TActions, context: TContext) => void,
): ContextMenuCommand<TContext, { actions: TActions }> {
  return {
    id,
    run: (context, services) => run(services.actions, context),
  }
}
