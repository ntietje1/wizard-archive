import { readFile, writeFile } from 'node:fs/promises'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const LOGO_PATH = 'public/logo.svg'
const STYLE_PATH = 'src/styles/app.css'
const WEB_MANIFEST_PATH = 'public/site.webmanifest'
const FAVICON_VIEWBOX_SIZE = 8192
const FAVICON_LOGO_SCALE = 0.87
const FAVICON_LOGO_VERTICAL_SHIFT = -0.03
const OG_BACKGROUND = '#111114'

const sourceLogoSvg = await readFile(LOGO_PATH, 'utf8')
const styleSheet = await readFile(STYLE_PATH, 'utf8')
const brandPrimaryColor = toStaticHex(readRootCustomProperty(styleSheet, '--primary'))
const shapeLogoSvg = stripLogoColor(sourceLogoSvg)
const brandLogoSvg = tintLogoSvg(shapeLogoSvg, brandPrimaryColor)
const webManifest = JSON.parse(await readFile(WEB_MANIFEST_PATH, 'utf8'))

webManifest.theme_color = brandPrimaryColor

await writeFile(LOGO_PATH, shapeLogoSvg)
await writeFile(WEB_MANIFEST_PATH, `${JSON.stringify(webManifest, null, 2)}\n`)

function createFaviconSvg() {
  const innerLogo = indentSvgContent(extractSvgInnerContent(shapeLogoSvg), 8)
  const inset = Math.round((FAVICON_VIEWBOX_SIZE * (1 - FAVICON_LOGO_SCALE)) / 2)
  const top = inset + Math.round(FAVICON_VIEWBOX_SIZE * FAVICON_LOGO_VERTICAL_SHIFT)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FAVICON_VIEWBOX_SIZE} ${FAVICON_VIEWBOX_SIZE}">
  <defs>
    <mask id="logo-cutout" maskUnits="userSpaceOnUse">
      <rect width="${FAVICON_VIEWBOX_SIZE}" height="${FAVICON_VIEWBOX_SIZE}" fill="#ffffff" />
      <g transform="translate(${inset} ${top}) scale(${FAVICON_LOGO_SCALE})" fill="#000000">
${innerLogo}
      </g>
    </mask>
  </defs>
  <circle cx="${FAVICON_VIEWBOX_SIZE / 2}" cy="${FAVICON_VIEWBOX_SIZE / 2}" r="${FAVICON_VIEWBOX_SIZE / 2}" fill="${brandPrimaryColor}" mask="url(#logo-cutout)" />
</svg>
`
}

async function renderFaviconPng(size) {
  return sharp(Buffer.from(createFaviconSvg()))
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer()
}

await writeFile('public/favicon.svg', createFaviconSvg())
await writeFile('public/safari-pinned-tab.svg', tintLogoSvg(shapeLogoSvg, '#000000'))

const pngTargets = [
  ['public/favicon-16x16.png', 16],
  ['public/favicon-32x32.png', 32],
  ['public/favicon.png', 48],
  ['public/apple-touch-icon.png', 180],
  ['public/android-chrome-192x192.png', 192],
  ['public/android-chrome-512x512.png', 512],
]

await Promise.all(
  pngTargets.map(async ([file, size]) => writeFile(file, await renderFaviconPng(size))),
)

await writeFile(
  'public/favicon.ico',
  await pngToIco(await Promise.all([16, 32, 48].map(renderFaviconPng))),
)

function stripLogoColor(svg) {
  return svg
    .replace(/fill:\s*(#[\da-f]{3,8}|oklch\([^)]*\)|rgb\([^)]*\)|currentColor)\s*;/giu, '')
    .replace(/<defs>\s*<style>\s*\.st0\s*\{\s*\}\s*<\/style>\s*<\/defs>\s*/iu, '')
    .replace(/\sclass="st0"/gu, '')
    .replace(/\sfill="[^"]*"/giu, '')
}

function tintLogoSvg(svg, color) {
  const xmlDeclaration = svg.match(/^\s*<\?xml[^>]*>\s*/u)?.[0] ?? ''
  const openingSvgTag = svg.match(/<svg\b[^>]*>/u)?.[0]
  const innerLogo = indentSvgContent(extractSvgInnerContent(svg), 4)

  if (!openingSvgTag) {
    throw new Error(`Could not find opening SVG tag in ${LOGO_PATH}`)
  }

  return `${xmlDeclaration}${openingSvgTag}
  <g fill="${color}">
${innerLogo}
  </g>
</svg>
`
}

function readRootCustomProperty(styleSheetContent, propertyName) {
  const rootBody = styleSheetContent.match(/:root\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body
  const propertyValue = rootBody?.match(
    new RegExp(`${escapeRegExp(propertyName)}\\s*:\\s*([^;]+);`, 'u'),
  )?.[1]

  if (!propertyValue) {
    throw new Error(`Could not find ${propertyName} in ${STYLE_PATH}`)
  }

  return propertyValue.trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function toStaticHex(cssColor) {
  const oklch = cssColor.match(
    /^oklch\(\s*(?<lightness>[\d.]+)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+)\s*\)$/u,
  )

  if (!oklch?.groups) {
    return cssColor
  }

  const lightness = Number(oklch.groups.lightness)
  const chroma = Number(oklch.groups.chroma)
  const hue = Number(oklch.groups.hue)
  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const linearRgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  return `#${linearRgb.map(toSrgbChannel).join('')}`
}

function toSrgbChannel(value) {
  const clamped = Math.min(1, Math.max(0, value))
  const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055

  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
}

function extractSvgInnerContent(svg) {
  return svg
    .replace(/^\s*<\?xml[^>]*>\s*/u, '')
    .replace(/^\s*<svg\b[^>]*>\s*/u, '')
    .replace(/\s*<\/svg>\s*$/u, '')
}

function indentSvgContent(svg, spaces) {
  const indent = ' '.repeat(spaces)

  return svg
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')
}

const ogLogo = await sharp(Buffer.from(brandLogoSvg))
  .resize(190, 190, { fit: 'contain' })
  .png()
  .toBuffer()

const ogText = Buffer.from(`
  <svg width="820" height="630" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="280" fill="#ffffff" font-size="92" font-family="Arial, sans-serif" font-weight="700">Wizard&apos;s Archive</text>
    <text x="4" y="360" fill="#d5d1df" font-size="40" font-family="Arial, sans-serif">Collaborative campaign manager for TTRPGs</text>
  </svg>
`)

await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    background: OG_BACKGROUND,
  },
})
  .composite([
    { input: ogLogo, top: 200, left: 138 },
    { input: ogText, top: 7, left: 378 },
  ])
  .png()
  .toFile('public/og-image.png')
