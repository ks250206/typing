/** DOM rectangles use screen pixels; layout and scroll offsets use unzoomed pixels. */
export function displayZoom() {
  return Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1
}
