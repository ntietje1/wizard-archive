import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'

type CampaignQueryRef = FunctionReference<'query', 'public'>

type CampaignQueryArgs<TQuery extends CampaignQueryRef> = Omit<FunctionArgs<TQuery>, 'campaignId'>

type CampaignQueryOptions<TQuery extends CampaignQueryRef> = Omit<
  UseQueryOptions<FunctionReturnType<TQuery>>,
  'queryKey' | 'queryFn' | 'retry'
>

export function useCampaignQuery<TQuery extends CampaignQueryRef>(
  query: TQuery,
  args: CampaignQueryArgs<TQuery> | 'skip',
  options?: CampaignQueryOptions<TQuery>,
): UseQueryResult<FunctionReturnType<TQuery>> {
  const { campaignId } = useCampaign()

  const fullArgs =
    args === 'skip' || !campaignId ? 'skip' : ({ ...args, campaignId } as FunctionArgs<TQuery>)

  return useAuthQuery(query, fullArgs, options)
}
