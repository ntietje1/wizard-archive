import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { ConvexReactClient } from 'convex/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { RootDocument } from '~/shared/components/root-document'
import { getOrigin } from '~/shared/utils/origin'
import { appBrowserChromeColors, appThemeColorMeta } from '~/shared/theme/browser-chrome'
import appCss from '~/styles/app.css?url'

const appTitle = "Wizard's Archive"
const appDescription = 'The collaborative campaign manager for TTRPGs.'
const appUrl = getOrigin()
const appImage = new URL('/og-image.png', appUrl).toString()

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: appTitle,
      },
      { name: 'description', content: appDescription },
      ...appThemeColorMeta,
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: appTitle },
      { property: 'og:description', content: appDescription },
      { property: 'og:url', content: appUrl },
      { property: 'og:image', content: appImage },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: appTitle },
      { name: 'twitter:description', content: appDescription },
      { name: 'twitter:image', content: appImage },
    ],
    links: [
      {
        rel: 'preload',
        href: '/fonts/inter-variable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'canonical', href: appUrl },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32-dark.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16-dark.png',
        media: '(prefers-color-scheme: dark)',
      },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: appBrowserChromeColors.fallback },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
    ],
  }),
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
})
