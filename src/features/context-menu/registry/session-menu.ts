import { createActionCommand } from './command'

export const sessionContextMenuCommands = {
  startSession: createActionCommand('startSession', (actions, context) =>
    actions.session.startSession(context),
  ),
  endSession: createActionCommand('endSession', (actions, context) =>
    actions.session.endSession(context),
  ),
}

export const sessionContextMenuContributors = []
