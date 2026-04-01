import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { ERROR_CODE, isClientError } from 'convex/errors'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

if (!convexUrl || !convexSiteUrl) {
  throw new Error(
    'Missing required environment variables: VITE_CONVEX_URL and VITE_CONVEX_SITE_URL',
  )
}

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
  jwtCache: {
    enabled: true,
    expirationToleranceSeconds: 60,
    isAuthError: (error) => isClientError(error, ERROR_CODE.NOT_AUTHENTICATED),
  },
})
