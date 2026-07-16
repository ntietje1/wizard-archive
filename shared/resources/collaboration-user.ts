import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

const COLLABORATION_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  '#61afef',
  '#c678dd',
  '#d19a66',
  '#be5046',
] as const

export function collaborationColor(memberId: CampaignMemberId): string {
  let hash = 0
  for (const character of memberId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return COLLABORATION_COLORS[Math.abs(hash) % COLLABORATION_COLORS.length]
}
