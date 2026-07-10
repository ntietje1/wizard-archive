import type { EditorShareParticipant } from './contracts'

export type ShareState = 'all' | 'some' | 'none'

export interface ShareItem {
  key: string
  participant: EditorShareParticipant
  shareState: ShareState
}

export const AGGREGATE_SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
  NOT_SHARED: 'not_shared',
  MIXED_SHARED: 'mixed_shared',
} as const

export type AggregateShareStatus =
  (typeof AGGREGATE_SHARE_STATUS)[keyof typeof AGGREGATE_SHARE_STATUS]
