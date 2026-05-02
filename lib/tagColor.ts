// Shared tag-color helper. Tags store either a hex value (modern) or a
// legacy named colour (gold | blue | purple | green | red | orange).
// Returns the trio of bg/border/text colours used to render tag chips.

const LEGACY_COLORS: Record<string, string> = {
  gold: '#c9a84c', blue: '#64a0ff', purple: '#a064f0',
  green: '#50c882', red: '#f06464', orange: '#f0a03c',
}

export function tagColor(color: string) {
  const hex = color.startsWith('#') ? color : (LEGACY_COLORS[color] ?? '#c9a84c')
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return {
    bg:     `rgba(${r},${g},${b},0.15)`,
    border: `rgba(${r},${g},${b},0.4)`,
    text:   hex,
  }
}
