export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export const SHARE_STATUS_VALUES = [
  SHARE_STATUS.ALL_SHARED,
  SHARE_STATUS.NOT_SHARED,
  SHARE_STATUS.INDIVIDUALLY_SHARED,
] as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]
