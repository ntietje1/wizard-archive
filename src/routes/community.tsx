import { createFileRoute } from '@tanstack/react-router'
import { publicPageHead, publicSite } from '~/features/landing/content/public-site'
import { CommunityRouteComponent } from './-community-route'

const communityChannels = publicSite.community.channels.filter((item) => item.href.length > 0)
const communityChannelLabelList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
}).format(communityChannels.map((item) => item.label))

export const Route = createFileRoute('/community')({
  head: () =>
    publicPageHead({
      title: 'Community',
      description: `Community channels for The Wizard's Archive, including ${communityChannelLabelList}.`,
    }),
  component: CommunityRouteComponent,
})
