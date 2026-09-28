// Picks the app's accent color (buttons, active nav, highlights) from the
// backdrop picture, so colored UI always matches whatever image is in use.

const HUE_BINS = 24
const MIN_COLOR_SHARE = 0.03 // below this the image is effectively black and white

export async function accentFromImage(src) {
  // A load event rather than img.decode(): decode() can stay pending in background tabs.
  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })

  const width = 64
  const height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(img, 0, 0, width, height)

  // Sample the lower part only: that is the part the fog leaves clear.
  const top = Math.floor(height * 0.4)
  const { data } = context.getImageData(0, top, width, height - top)

  // Group pixels by hue, favoring saturated mid-tones over near-greys.
  const bins = Array.from({ length: HUE_BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }))
  let pixels = 0
  for (let i = 0; i < data.length; i += 4) {
    pixels++
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const [hue, saturation, lightness] = rgbToHsl(r, g, b)
    if (saturation < 0.12 || lightness < 0.08 || lightness > 0.94) continue
    const weight = saturation * (1 - Math.abs(lightness - 0.5))
    const bin = bins[Math.floor(hue * HUE_BINS) % HUE_BINS]
    bin.weight += weight
    bin.r += r * weight
    bin.g += g * weight
    bin.b += b * weight
  }

  const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a))
  if (best.weight / pixels < MIN_COLOR_SHARE) return null

  const [hue, saturation] = rgbToHsl(best.r / best.weight, best.g / best.weight, best.b / best.weight)
  return buildPalette(hue, saturation)
}

function buildPalette(hue, saturation) {
  const s = clamp(saturation, 0.28, 0.62)
  // Darken until white text on the color passes WCAG AA contrast (4.5:1).
  let l = 0.5
  while (l > 0.15 && contrastWithWhite(hslToRgb(hue, s, l)) < 4.8) l -= 0.01

  return {
    accent: toCss(hue, s, l),
    hover: toCss(hue, s, Math.max(l - 0.07, 0.1)),
    soft: toCss(hue, Math.min(s, 0.45), 0.94),
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toCss = (h, s, l) => `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((v) => v * 255)
}

function contrastWithWhite([r, g, b]) {
  const channel = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return 1.05 / (luminance + 0.05)
}
