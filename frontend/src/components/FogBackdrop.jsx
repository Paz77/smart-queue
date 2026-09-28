import { useEffect, useLayoutEffect } from 'react'
import { useOrganization } from '../context/organization'
import { accentFromImage } from '../utils/imageAccent'

const CACHE_PREFIX = 'queuesmart:accent:'

function applyPalette(palette) {
  const root = document.documentElement.style
  root.setProperty('--color-accent', palette.accent)
  root.setProperty('--color-accent-hover', palette.hover)
  root.setProperty('--color-accent-soft', palette.soft)
}

function readCachedPalette(image) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + image))
  } catch {
    return null
  }
}

function cachePalette(image, palette) {
  try {
    localStorage.setItem(CACHE_PREFIX + image, JSON.stringify(palette))
  } catch {
    // Without storage the color is simply worked out again next time.
  }
}

// Full-screen background picture that is clear at the bottom and dissolves
// into fog toward the top, so page headers always sit on a calm surface.
//
// The picture comes from the current organization (backdropUrl), or pass one:
// <FogBackdrop image="/some-picture.jpg" />. Buttons and highlights recolor to
// match it; pass matchAccent={false} to keep the default accent from index.css.
export function FogBackdrop({ image, matchAccent = true }) {
  const { organization } = useOrganization()
  const src = image ?? organization.backdropUrl

  // Apply the remembered color before the first paint, so there is no flash of the default.
  useLayoutEffect(() => {
    if (!matchAccent) return
    const cached = readCachedPalette(src)
    if (cached) applyPalette(cached)
  }, [src, matchAccent])

  // Then work the color out from the picture itself (and remember it for next time).
  useEffect(() => {
    if (!matchAccent) return
    let cancelled = false
    accentFromImage(src)
      .then((palette) => {
        if (cancelled || !palette) return
        applyPalette(palette)
        cachePalette(src, palette)
      })
      // If the picture cannot be read, the current accent stays.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [src, matchAccent])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      {/* The sharp picture. */}
      <img src={src} alt="" className="absolute inset-0 size-full object-cover object-bottom" />
      {/* A blurred copy on top of it, fully visible at the top and faded out toward the bottom. */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 size-full scale-110 object-cover object-bottom blur-2xl [mask-image:linear-gradient(to_bottom,#000_20%,transparent_70%)]"
      />
      {/* A white wash that thins out as it goes down: fog at the top, clear at the bottom. */}
      <div className="absolute inset-0 bg-linear-to-b from-canvas from-10% via-canvas/55 via-40% to-transparent to-80%" />
    </div>
  )
}
