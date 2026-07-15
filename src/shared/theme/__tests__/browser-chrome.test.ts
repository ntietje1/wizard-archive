import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import {
  appBrowserChromeColors,
  appThemeColorMeta,
  getAppThemeColor,
} from '~/shared/theme/browser-chrome'
import { applyThemeClass } from '~/shared/theme/dom'

describe('browser chrome theme contract', () => {
  it('exposes a fallback theme-color meta entry for server-rendered head output', () => {
    expect(appThemeColorMeta).toEqual([
      {
        name: 'theme-color',
        content: appBrowserChromeColors.fallback,
      },
    ])
  })

  it('updates the theme-color meta tag from the resolved app theme', () => {
    document.head.innerHTML = `<meta name="theme-color" content="${appBrowserChromeColors.fallback}">`

    applyThemeClass('dark')
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      getAppThemeColor('dark'),
    )

    applyThemeClass('light')
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      getAppThemeColor('light'),
    )
  })

  it('keeps the static manifest aligned with the named browser chrome colors', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'public/site.webmanifest'), 'utf8'),
    ) as { theme_color?: string; background_color?: string }

    expect(manifest.theme_color).toBe(appBrowserChromeColors.manifestTheme)
    expect(manifest.background_color).toBe(appBrowserChromeColors.manifestBackground)
  })
})
