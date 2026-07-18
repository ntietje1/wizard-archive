import type { AuthoredDestination } from './authored-destination-contract'

export type AuthoredDestinationDropResolver = Readonly<{
  canResolve(dataTransfer: Pick<DataTransfer, 'types'>): boolean
  resolveFiles(
    files: ReadonlyArray<File>,
    maximumDestinations: number,
    signal: AbortSignal,
  ): Promise<ReadonlyArray<AuthoredDestination>>
  resolve(
    dataTransfer: DataTransfer,
    maximumDestinations: number,
    signal: AbortSignal,
  ): Promise<ReadonlyArray<AuthoredDestination>>
}>
