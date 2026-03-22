import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { toast } from 'sonner'
import type {
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

type MutationRef = FunctionReference<'mutation', 'public'>

type TData<TMutation extends MutationRef> = FunctionReturnType<TMutation>
type TArgs<TMutation extends MutationRef> = FunctionArgs<TMutation>

type UseAppMutationOptions<
  TMutation extends MutationRef,
  TContext = unknown,
> = Omit<
  UseMutationOptions<TData<TMutation>, Error, TArgs<TMutation>, TContext>,
  'mutationFn'
> & {
  errorMessage?: string
}

export function useAppMutation<
  TMutation extends MutationRef,
  TContext = unknown,
>(
  mutation: TMutation,
  options?: UseAppMutationOptions<TMutation, TContext>,
): UseMutationResult<TData<TMutation>, Error, TArgs<TMutation>, TContext> {
  const convexMutation = useConvexMutation(mutation)
  const { errorMessage, onError, ...rest } = options ?? {}

  return useMutation({
    mutationFn: (args: TArgs<TMutation>) => convexMutation(args),
    onError: onError
      ? onError
      : (_error) => {
          toast.error(errorMessage ?? 'Something went wrong')
        },
    ...rest,
  } as UseMutationOptions<TData<TMutation>, Error, TArgs<TMutation>, TContext>)
}
