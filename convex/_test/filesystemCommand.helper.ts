import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId } from '@wizard-archive/editor/resources/domain-id'
import type { FunctionArgs } from 'convex/server'
import type { TestConvexForDataModel } from 'convex-test'
import { api } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'

type ExecuteFileSystemCommandArgs = FunctionArgs<
  typeof api.sidebarItems.filesystem.mutations.executeFileSystemCommand
>

export function executeTestFileSystemCommand(
  client: TestConvexForDataModel<DataModel>,
  args: Omit<ExecuteFileSystemCommandArgs, 'operationId'> & { operationId?: OperationId },
) {
  return client.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
    ...args,
    operationId: args.operationId ?? generateDomainId(DOMAIN_ID_KIND.operation),
  })
}
