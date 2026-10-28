import { useColorScheme } from 'react-native';

// Large, readable type and roomy tap targets are the default, not an option.
// The app is used at the bench, often with glasses off and hands busy.

// Light navy grounds with pastel purple for buttons and selected choices.
// Pastel purple is too faint for text on white, so links and labels use a
// deeper purple from the same family (accent), and buttons use the pastel (fill).
const light = {
  background: '#E7ECF5', // light navy tint
  surface: '#FFFFFF',
  text: '#1C2540', // navy ink
  muted: '#55607A',
  border: '#C9D2E3',
  accent: '#6A4FB4', // purple for links, icons and labels
  accentText: '#1C2540',
  fill: '#C9B6F2', // pastel purple buttons and selected chips
  onFill: '#1C2540',
  coe90: '#2D7F55', // emerald
  coe96: '#9A5A0E', // amber
  danger: '#B0283F', // ruby
  onDanger: '#FFFFFF',
  accentSoft: '#EEE8FB',
  input: '#FFFFFF',
};

const dark: typeof light = {
  background: '#2B3A5A', // light navy
  surface: '#34456A',
  text: '#F2F4FA',
  muted: '#BAC4D8',
  border: '#4B5C82',
  accent: '#D3C1F8',
  accentText: '#1E2742',
  fill: '#C4AEF2',
  onFill: '#1E2742',
  coe90: '#86D9AC',
  coe96: '#F2C277',
  danger: '#FF9AA9',
  onDanger: '#1E2742',
  accentSoft: '#45507E',
  input: '#283654',
};

export type Colors = typeof light;

export const type = {
  title: 30,
  heading: 22,
  body: 19,
  label: 16,
  small: 14,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Minimum height for anything tappable. Apple's guideline is 44pt; we go larger. */
export const tapTarget = 52;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
