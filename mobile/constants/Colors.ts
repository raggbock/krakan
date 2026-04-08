// Fyndstigen color palette — matches web globals.css
export const colors = {
  parchment: '#F5F0E8',
  espresso: '#3E2C23',
  rust: '#B85C38',
  rustLight: '#CF7B5A',
  mustard: '#D4A843',
  forest: '#4A7C59',
  lavender: '#8B7BB4',
  creamWarm: '#EDE6D6',
  card: '#FAF7F0',
  error: '#C0392B',
} as const

const tintColorLight = colors.rust
const tintColorDark = colors.rustLight

export default {
  light: {
    text: colors.espresso,
    textMuted: 'rgba(62, 44, 35, 0.5)',
    background: colors.parchment,
    card: colors.card,
    border: colors.creamWarm,
    tint: tintColorLight,
    tabIconDefault: 'rgba(62, 44, 35, 0.3)',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: colors.parchment,
    textMuted: 'rgba(245, 240, 232, 0.5)',
    background: '#1A1210',
    card: '#2A1F1A',
    border: '#3E2C23',
    tint: tintColorDark,
    tabIconDefault: 'rgba(245, 240, 232, 0.3)',
    tabIconSelected: tintColorDark,
  },
}
