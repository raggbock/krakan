import L from 'leaflet'

const defaultMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

const inactiveMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23998A7A"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

function svgIcon(svg: string, size: [number, number] = [28, 40], anchor?: [number, number]): L.Icon {
  return new L.Icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: size,
    iconAnchor: anchor ?? [size[0] / 2, size[1]],
    popupAnchor: [0, -(anchor?.[1] ?? size[1]) + 4],
  })
}

export const markerIcon = svgIcon(defaultMarkerSvg)

export const inactiveMarkerIcon = svgIcon(inactiveMarkerSvg)

const numberedCache = new Map<number, L.Icon>()

export function numberedMarkerIcon(num: number): L.Icon {
  let icon = numberedCache.get(num)
  if (!icon) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/><text x="14" y="17" text-anchor="middle" font-size="11" font-weight="bold" fill="%23C45B35" font-family="sans-serif">${num}</text></svg>`
    icon = svgIcon(svg)
    numberedCache.set(num, icon)
  }
  return icon
}

export const startPointIcon = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%235B7352" stroke="white" stroke-width="2"/></svg>`,
  [20, 20],
  [10, 10],
)
