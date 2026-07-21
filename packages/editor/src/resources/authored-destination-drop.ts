import type { AuthoredDestination } from './authored-destination-contract'
import type { ResourceId } from './domain-id'

export type AuthoredResourceCreationSettlement =
  | Readonly<{ status: 'completed'; resourceId: ResourceId }>
  | Readonly<{
      status: 'indeterminate'
      reason: 'connection_lost' | 'response_lost' | 'timeout'
      retry: () => Promise<AuthoredResourceCreationSettlement>
    }>
  | Readonly<{
      status: 'failed'
      reason: string
      retry: (() => Promise<AuthoredResourceCreationSettlement>) | null
    }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'rejected'; reason: string }>

export type AuthoredDestinationDropResult =
  | Readonly<{
      kind: 'destinations'
      destinations: ReadonlyArray<AuthoredDestination>
    }>
  | Readonly<{
      kind: 'resourceCreations'
      settlements: ReadonlyArray<AuthoredResourceCreationSettlement>
    }>

export type AuthoredDestinationDropResolver = Readonly<{
  canResolve(dataTransfer: Pick<DataTransfer, 'getData' | 'types'>): boolean
  resolveFiles(
    files: ReadonlyArray<File>,
    maximumDestinations: number,
    signal: AbortSignal,
  ): Promise<AuthoredDestinationDropResult>
  resolve(
    dataTransfer: DataTransfer,
    maximumDestinations: number,
    signal: AbortSignal,
  ): Promise<AuthoredDestinationDropResult>
}>
