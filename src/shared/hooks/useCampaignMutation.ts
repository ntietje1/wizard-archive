import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'

type MutationRef = FunctionReference<'mutation', 'public'>

type TData<TMutation extends MutationRef> = FunctionReturnType<TMutation>
type TFullArgs<TMutation extends MutationRef> = FunctionArgs<TMutation>
type TArgs<TMutation extends MutationRef> = Omit<FunctionArgs<TMutation>, 'campaignId'>

type UseCampaignMutationOptions<TMutation extends MutationRef, TContext = unknown> = Omit<
  UseMutationOptions<TData<TMutation>, Error, TArgs<TMutation>, TContext>,
  'mutationFn'
>

export function useCampaignMutation<TMutation extends MutationRef, TContext = unknown>(
  mutation: TMutation,
  options?: UseCampaignMutationOptions<TMutation, TContext>,
): UseMutationResult<TData<TMutation>, Error, TArgs<TMutation>, TContext> {
  const { campaignId } = useCampaign()
  const convexMutation = useConvexMutation(mutation)

  return useMutation({
    mutationFn: (args: TArgs<TMutation>) => {
      if (!campaignId) throw new Error('useCampaignMutation requires a campaign context')
      return convexMutation({ ...args, campaignId } as TFullArgs<TMutation>)
    },
    ...options,
  } as UseMutationOptions<TData<TMutation>, Error, TArgs<TMutation>, TContext>)
}
