import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, ChipRow, Label } from '@/components/ui';
import {
  COMMON_SIZES,
  formatArea,
  parseDimension,
  sizeLabel,
  sortSizes,
  totalAreaSqIn,
  totalSheets,
  type SheetSize,
} from '@/domain/sizes';
import { space, tapTarget, type, useColors } from '@/theme/theme';

/** One size with its count and − / + buttons. Shared by the form and the glass page. */
export function SizeRow({
  size,
  onChange,
  onRemove,
}: {
  size: SheetSize;
  onChange: (delta: number) => void;
  onRemove?: () => void;
}) {
  const c = useColors();
  const label = sizeLabel(size.width, size.height);
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={[styles.size, { color: size.count === 0 ? c.muted : c.text }]}>{label}</Text>
        <Text style={[styles.unit, { color: c.muted }]}>inches</Text>
      </View>
      <View style={styles.counter}>
        <RoundButton icon="remove" label={`One less ${label}`} onPress={() => onChange(-1)} disabled={size.count <= 0} />
        <Text style={[styles.count, { color: size.count === 0 ? c.danger : c.text }]} accessibilityLabel={`${size.count} sheets of ${label}`}>
          {size.count}
        </Text>
        <RoundButton icon="add" label={`One more ${label}`} onPress={() => onChange(1)} />
      </View>
      {onRemove && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove size ${label}`} hitSlop={8} style={styles.remove}>
          <Ionicons name="close" size={22} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

/** "7 sheets · 5 sq ft". */
export function SizeTotals({ sizes }: { sizes: SheetSize[] }) {
  const c = useColors();
  const n = totalSheets(sizes);
  return (
    <Text style={[styles.totals, { color: n === 0 ? c.danger : c.text }]}>
      {n === 0 ? 'Out of every size' : `${n} ${n === 1 ? 'sheet' : 'sheets'} · ${formatArea(totalAreaSqIn(sizes))}`}
    </Text>
  );
}

/** Pick a common size or type one, e.g. 8 1/2 × 11. */
export function AddSize({ existing, onAdd }: { existing: SheetSize[]; onAdd: (width: number, height: number) => void }) {
  const c = useColors();
  const [custom, setCustom] = useState(false);
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [error, setError] = useState<string | undefined>();
  const has = (a: number, b: number) => existing.some((s) => s.width === a && s.height === b);

  const addCustom = () => {
    const width = parseDimension(w);
    const height = parseDimension(h);
    if (width === null || height === null) {
      setError('Enter both sides in inches, like 8 and 10.');
      return;
    }
    onAdd(width, height);
    setW('');
    setH('');
    setError(undefined);
    setCustom(false);
  };

  const common = COMMON_SIZES.filter(([a, b]) => !has(a, b));
  return (
    <View style={styles.add}>
      <ChipRow>
        {common.map(([a, b]) => (
          <Chip key={`${a}x${b}`} label={`+ ${sizeLabel(a, b)}`} onPress={() => onAdd(a, b)} />
        ))}
        <Chip label="Other size" selected={custom} onPress={() => setCustom(!custom)} />
      </ChipRow>
      {custom && (
        <View style={styles.customBlock}>
          <View style={styles.custom}>
            <TextInput
              value={w}
              onChangeText={setW}
              placeholder="Width"
              placeholderTextColor={c.muted}
              keyboardType="decimal-pad"
              accessibilityLabel="Width in inches"
              style={[styles.dim, { color: c.text, borderColor: error ? c.danger : c.border, backgroundColor: c.input }]}
            />
            <Text style={[styles.times, { color: c.muted }]}>×</Text>
            <TextInput
              value={h}
              onChangeText={setH}
              placeholder="Height"
              placeholderTextColor={c.muted}
              keyboardType="decimal-pad"
              accessibilityLabel="Height in inches"
              style={[styles.dim, { color: c.text, borderColor: error ? c.danger : c.border, backgroundColor: c.input }]}
              onSubmitEditing={addCustom}
            />
            <Text style={[styles.times, { color: c.muted }]}>in</Text>
          </View>
          {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
          <Button label="Add this size" variant="secondary" onPress={addCustom} />
        </View>
      )}
    </View>
  );
}

/** The form's sizes section: list, totals and add. */
export function SizesEditor({
  sizes,
  onChange,
  error,
}: {
  sizes: SheetSize[];
  onChange: (next: SheetSize[]) => void;
  error?: string;
}) {
  const c = useColors();
  const sorted = sortSizes(sizes);
  const change = (s: SheetSize, delta: number) =>
    onChange(sizes.map((x) => (x.width === s.width && x.height === s.height ? { ...x, count: Math.max(0, x.count + delta) } : x)));
  return (
    <View style={styles.editor}>
      <Label hint="Add each size you have and how many of it." error={error}>
        Sizes on hand
      </Label>
      {sorted.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {sorted.map((s) => (
            <SizeRow
              key={`${s.width}x${s.height}`}
              size={s}
              onChange={(d) => change(s, d)}
              onRemove={() => onChange(sizes.filter((x) => !(x.width === s.width && x.height === s.height)))}
            />
          ))}
          <SizeTotals sizes={sizes} />
        </View>
      )}
      <AddSize
        existing={sizes}
        onAdd={(w, h) => {
          const [a, b] = w <= h ? [w, h] : [h, w];
          const found = sizes.find((s) => s.width === a && s.height === b);
          onChange(found ? sizes.map((s) => (s === found ? { ...s, count: s.count + 1 } : s)) : [...sizes, { width: a, height: b, count: 1 }]);
        }}
      />
    </View>
  );
}

function RoundButton({ icon, label, onPress, disabled }: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.round,
        { borderColor: c.border, backgroundColor: c.accentSoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={24} color={c.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editor: { gap: space.sm },
  card: { borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: tapTarget },
  rowLabel: { flex: 1, minWidth: 0 },
  size: { fontSize: type.heading, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: type.small },
  counter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { minWidth: 36, textAlign: 'center', fontSize: type.heading, fontWeight: '700', fontVariant: ['tabular-nums'] },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  remove: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  totals: { fontSize: type.label, fontWeight: '700', paddingVertical: space.sm },
  add: { gap: space.sm },
  customBlock: { gap: space.sm },
  custom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dim: { flex: 1, minHeight: tapTarget, borderWidth: 1, borderRadius: 10, paddingHorizontal: space.md, fontSize: type.body, minWidth: 0 },
  times: { fontSize: type.body, fontWeight: '700' },
  error: { fontSize: type.small, fontWeight: '600' },
});
