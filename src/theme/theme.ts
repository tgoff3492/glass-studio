import { useColorScheme } from 'react-native';

// Large, readable type and roomy tap targets are the default, not an option.
// The app is used at the bench, often with glasses off and hands busy.

const light = {
  background: '#F5F6F4',
  surface: '#FFFFFF',
  text: '#1D2125',
  muted: '#59636D',
  border: '#D8DDE1',
  accent: '#2D5DAE', // cobalt
  accentText: '#FFFFFF',
  coe90: '#2D7F55', // emerald
  coe96: '#9A5A0E', // amber
  danger: '#B0283F', // ruby
  accentSoft: '#E3EBF8',
  input: '#FFFFFF',
};

const dark: typeof light = {
  background: '#121518',
  surface: '#1B2025',
  text: '#E9ECEE',
  muted: '#A0AAB4',
  border: '#2E363E',
  accent: '#7EA6EB',
  accentText: '#0E1520',
  coe90: '#62C493',
  coe96: '#E6AE58',
  danger: '#E36A7E',
  accentSoft: '#1F2D44',
  input: '#14181C',
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
