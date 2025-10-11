export type GradientStop = {
  offset: number
  color: string
}

export type HexPatternTheme = {
  /** Background gradient behind the tiles */
  baseGradient: GradientStop[]
  /** Solid fill of the hex tile before lighting */
  hexFill: string
  /** Radial gradient used for the inner glow of the tile */
  innerGradient: GradientStop[]
  /** Linear gradient that fakes light hitting the top of the tile */
  topLightStops: GradientStop[]
  /** Outer rim gradient applied with stroke */
  rimGradient: GradientStop[]
  /** Inner rim gradient applied with stroke inside the hex */
  innerRimGradient: GradientStop[]
  /** Final outline stroke */
  outline: string
}

export const HEX_PATTERN_THEME: HexPatternTheme = {
  baseGradient: [
    { offset: 0, color: '#0b0f16' },
    { offset: 1, color: '#151a24' },
  ],
  hexFill: '#111722',
  innerGradient: [
    { offset: 0, color: '#131a26' },
    { offset: 0.65, color: '#0e1420' },
    { offset: 1, color: '#0a0f18' },
  ],
  topLightStops: [
    { offset: 0, color: 'rgba(97,123,163,0.22)' },
    { offset: 0.4, color: 'rgba(61,82,113,0.15)' },
    { offset: 1, color: 'rgba(0,0,0,0)' },
  ],
  rimGradient: [
    { offset: 0, color: '#27384f' },
    { offset: 0.5, color: '#1d2735' },
    { offset: 1, color: '#121925' },
  ],
  innerRimGradient: [
    { offset: 0, color: 'rgba(59,130,246,0.24)' },
    { offset: 1, color: 'rgba(12,23,38,0.42)' },
  ],
  outline: '#0a0e14',
}
