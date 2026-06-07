export const appBrowserChromeColors = {
  light: '#FAF7FA',
  dark: '#201E22',
  fallback: '#7B6FD4',
  manifestTheme: '#7B6FD4',
  manifestBackground: '#201E22',
} as const

export const appThemeColorMeta = [
  {
    name: 'theme-color',
    content: appBrowserChromeColors.fallback,
  },
] as const

export function getAppThemeColor(resolved: 'dark' | 'light') {
  return appBrowserChromeColors[resolved]
}
