import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { space, tapTarget, type, useColors } from '@/theme/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, style, accessibilityHint }: ButtonProps) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : c.surface;
  const fg = variant === 'secondary' ? c.accent : c.accentText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? c.border : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: variant === 'danger' ? '#FFFFFF' : fg }]}>{label}</Text>
    </Pressable>
  );
}

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  swatch?: string;
};

/** A tappable choice. Used for filters and for picking one option in forms. */
export function Chip({ label, selected, onPress, swatch }: ChipProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: selected ? c.accent : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {swatch && <View style={[styles.swatch, { backgroundColor: swatch, borderColor: c.border }]} />}
      <Text style={[styles.chipText, { color: selected ? c.accentText : c.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

export function Field({ label, hint, error, style, ...input }: FieldProps) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {hint && <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.input, borderColor: error ? c.danger : c.border },
          input.multiline && styles.multiline,
          style,
        ]}
        {...input}
      />
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

export function Label({ children, hint, error }: { children: string; hint?: string; error?: string }) {
  const c = useColors();
  return (
    <View style={styles.labelBlock}>
      <Text style={[styles.label, { color: c.text }]}>{children}</Text>
      {hint && <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>}
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

/** Centers content and keeps it a comfortable width on iPad. */
export function Column({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: tapTarget,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: type.body, fontWeight: '700' },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  chipText: { fontSize: type.label, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
  field: { gap: space.xs },
  labelBlock: { gap: space.xs, marginBottom: space.xs },
  label: { fontSize: type.label, fontWeight: '700' },
  hint: { fontSize: type.small },
  input: {
    minHeight: tapTarget,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: space.md,
    fontSize: type.body,
  },
  multiline: { minHeight: 110, paddingTop: space.md, textAlignVertical: 'top' },
  error: { fontSize: type.small, fontWeight: '600' },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
});
