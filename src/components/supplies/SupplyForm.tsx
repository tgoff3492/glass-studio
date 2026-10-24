import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoSlot } from '@/components/glass/PhotoSlot';
import { Button, Chip, ChipRow, Column, Field, Label } from '@/components/ui';
import { UNIT_LABELS } from '@/domain/glass';
import {
  SUPPLY_CATEGORIES,
  SUPPLY_GROUPS,
  categoryInfo,
  changeCategory,
  validateSupplyInput,
  type SupplyFields,
  type SupplyInput,
} from '@/domain/supplies';
import { space, type, useColors } from '@/theme/theme';

type Props = {
  initial: SupplyInput;
  submitLabel: string;
  onSubmit: (fields: SupplyFields) => Promise<void>;
  onCancel: (current: SupplyInput) => void;
};

export function SupplyForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<SupplyInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof SupplyInput, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SupplyInput>(key: K, value: SupplyInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    const result = validateSupplyInput(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(result.value);
    } finally {
      setSaving(false);
    }
  };

  const info = categoryInfo(input.category);
  const unitMany = UNIT_LABELS[input.unit].many;
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Column style={styles.form}>
          <View style={styles.group}>
            <Label>What is it?</Label>
            {SUPPLY_GROUPS.map((g) => (
              <View key={g.value} style={styles.subgroup}>
                <Text style={[styles.groupName, { color: c.muted }]}>{g.label.toUpperCase()}</Text>
                <ChipRow>
                  {SUPPLY_CATEGORIES.filter((cat) => cat.group === g.value).map((cat) => (
                    <Chip
                      key={cat.value}
                      label={cat.label}
                      selected={input.category === cat.value}
                      onPress={() => {
                        setInput((prev) => changeCategory(prev, cat.value));
                        setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                    />
                  ))}
                </ChipRow>
              </View>
            ))}
          </View>

          <Field label="Name" value={input.name} onChangeText={(t) => set('name', t)} error={errors.name} autoCapitalize="sentences" />

          <Field
            label="Size or type"
            hint={info.sizeHint ? `For example: ${info.sizeHint}` : undefined}
            value={input.size}
            onChangeText={(t) => set('size', t)}
            autoCorrect={false}
          />

          <Field label="Brand" hint="Optional." value={input.brand} onChangeText={(t) => set('brand', t)} autoCapitalize="words" />

          <View style={styles.group}>
            <Field
              label="How much do you have?"
              value={input.quantity}
              onChangeText={(t) => set('quantity', t)}
              error={errors.quantity}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            {info.units.length > 1 && (
              <ChipRow>
                {info.units.map((u) => (
                  <Chip key={u} label={UNIT_LABELS[u].many} selected={input.unit === u} onPress={() => set('unit', u)} />
                ))}
              </ChipRow>
            )}
            {info.units.length === 1 && <Text style={[styles.unit, { color: c.muted }]}>Counted in {unitMany}.</Text>}
          </View>

          <Field
            label="Remind me when I'm down to"
            hint={`Optional. When you have this many ${unitMany} or fewer, it goes on the shopping list.`}
            placeholder="No reminder"
            value={input.min_quantity}
            onChangeText={(t) => set('min_quantity', t)}
            error={errors.min_quantity}
            keyboardType="decimal-pad"
          />

          <Field
            label={`Price paid per ${UNIT_LABELS[input.unit].one}`}
            hint="Optional. Used later to work out what a piece costs to make."
            placeholder="0.00"
            value={input.cost}
            onChangeText={(t) => set('cost', t)}
            error={errors.cost}
            keyboardType="decimal-pad"
          />

          <PhotoSlot label="Photo" hint="Optional. Handy for remembering which bottle or bit to reorder." uri={input.photo_uri} onChange={(u) => set('photo_uri', u)} />

          <Field label="Notes" placeholder="Where you buy it, what it's for" value={input.notes} onChangeText={(t) => set('notes', t)} multiline />

          {errorCount > 0 && (
            <Text style={[styles.summary, { color: c.danger }]}>
              {errorCount === 1 ? 'One thing needs fixing above.' : `${errorCount} things need fixing above.`}
            </Text>
          )}
          <View style={styles.actions}>
            <Button label={saving ? 'Saving…' : submitLabel} onPress={save} disabled={saving} />
            <Button label="Cancel" variant="secondary" onPress={() => onCancel(input)} disabled={saving} />
          </View>
        </Column>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.md },
  form: { gap: space.lg },
  group: { gap: space.sm },
  subgroup: { gap: space.xs },
  groupName: { fontSize: type.small, fontWeight: '700', letterSpacing: 0.8 },
  unit: { fontSize: type.small },
  summary: { fontSize: type.label, fontWeight: '700' },
  actions: { gap: space.sm },
});
