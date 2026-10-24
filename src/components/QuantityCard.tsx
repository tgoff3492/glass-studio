import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuantityUnit } from '@/db/types';
import { STEP_FOR_UNIT, UNIT_LABELS, formatQuantity } from '@/domain/glass';
import { space, type, useColors } from '@/theme/theme';

type Props = {
  quantity: number;
  unit: QuantityUnit;
  onChange: (delta: number) => void;
  /** Extra line under the stepper, such as a low-stock warning. */
  status?: { text: string; tone: 'muted' | 'warn' | 'danger' };
};

/** "On hand" with big − and + buttons, used on glass and supply pages. */
export function QuantityCard({ quantity, unit, onChange, status }: Props) {
  const c = useColors();
  const step = STEP_FOR_UNIT[unit] ?? 1;
  const many = UNIT_LABELS[unit]?.many ?? unit;
  const toneColor = status?.tone === 'danger' ? c.danger : status?.tone === 'warn' ? c.coe96 : c.muted;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.muted }]}>ON HAND</Text>
      <View style={styles.stepper}>
        <StepButton icon="remove" label={`Use ${step} ${many}`} onPress={() => onChange(-step)} disabled={quantity <= 0} />
        <Text style={[styles.amount, { color: quantity === 0 ? c.danger : c.text }]} accessibilityLiveRegion="polite">
          {quantity === 0 ? 'Out' : formatQuantity(quantity, unit)}
        </Text>
        <StepButton icon="add" label={`Add ${step} ${many}`} onPress={() => onChange(step)} />
      </View>
      {status && <Text style={[styles.status, { color: toneColor }]}>{status.text}</Text>}
      <Text style={[styles.small, { color: c.muted }]}>
        Each tap changes it by {formatQuantity(step, unit)}. Tap Edit to type an exact amount.
      </Text>
    </View>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.step,
        { borderColor: c.border, backgroundColor: c.accentSoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={30} color={c.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: space.md },
  label: { fontSize: type.small, fontWeight: '700', letterSpacing: 0.8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  step: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  amount: { flex: 1, textAlign: 'center', fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  status: { fontSize: type.label, fontWeight: '700' },
  small: { fontSize: type.small },
});
