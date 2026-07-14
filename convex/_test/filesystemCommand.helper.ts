import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { FunctionArgs } from 'convex/server'
import type { TestConvexForDataModel } from 'convex-test'
import { api } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'

type ExecuteFileSystemCommandArgs = FunctionArgs<
  typeof api.sidebarItems.filesystem.mutations.executeFileSystemCommand
>
type TestFileSystemCommand = ExecuteFileSystemCommandArgs['command'] extends infer TCommand
  ? TCommand extends { type: 'create'; resourceId: ResourceId }
    ? Omit<TCommand, 'resourceId'> & { resourceId?: ResourceId }
    : TCommand
  : never

export function executeTestFileSystemCommand(
  client: TestConvexForDataModel<DataModel>,
  args: Omit<ExecuteFileSystemCommandArgs, 'command' | 'operationId'> & {
    command: TestFileSystemCommand
    operationId?: OperationId
  },
) {
  const command =
    args.command.type === 'create'
      ? {
          ...args.command,
          resourceId: args.command.resourceId ?? generateDomainId(DOMAIN_ID_KIND.resource),
        }
      : args.command
  return client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    ...args,
    command,
    operationId: args.operationId ?? generateDomainId(DOMAIN_ID_KIND.operation),
  })
}
