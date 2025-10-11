export type GradientStop = {
  offset: number
  color: string
}

export type HexPatternTheme = {
  baseGradient: GradientStop[]
  hexFill: string
  innerGradient: GradientStop[]
  topLightStops: GradientStop[]
  rimGradient: GradientStop[]
  innerRimGradient: GradientStop[]
  outline: string
}

export const HEX_PATTERN_THEME: HexPatternTheme = {
  baseGradient: [
    { offset: 0, color: '#050505' },
    { offset: 1, color: '#0a0a0a' },
  ],
  hexFill: '#070707',
  innerGradient: [
    { offset: 0, color: '#0b0b0b' },
    { offset: 0.65, color: '#060606' },
    { offset: 1, color: '#020202' },
  ],
  topLightStops: [
    { offset: 0, color: 'rgba(25,25,25,0.2)' },
    { offset: 0.4, color: 'rgba(15,15,15,0.15)' },
    { offset: 1, color: 'rgba(0,0,0,0)' },
  ],
  rimGradient: [
    { offset: 0, color: '#111111' },
    { offset: 0.5, color: '#0b0b0b' },
    { offset: 1, color: '#050505' },
  ],
  innerRimGradient: [
    { offset: 0, color: 'rgba(20,20,20,0.25)' },
    { offset: 1, color: 'rgba(5,5,5,0.4)' },
  ],
  outline: '#000000',
}
