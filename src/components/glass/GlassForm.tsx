import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoSlot } from '@/components/glass/PhotoSlot';
import { Button, Chip, ChipRow, Column, Field, Label } from '@/components/ui';
import { listManufacturers } from '@/db/glassRepo';
import type { Coe, GlassKind } from '@/db/types';
import {
  COLOR_FAMILIES,
  GLASS_KINDS,
  GLASS_TYPES,
  MANUFACTURERS,
  UNIT_LABELS,
  UNITS_FOR_KIND,
  kindLabel,
  validateGlassInput,
  type GlassFields,
  type GlassInput,
} from '@/domain/glass';
import { space, type, useColors } from '@/theme/theme';

type Props = {
  initial: GlassInput;
  submitLabel: string;
  onSubmit: (fields: GlassFields) => Promise<void>;
  /** Called with what was on screen, so the caller can clean up photos taken but not saved. */
  onCancel: (current: GlassInput) => void;
};

const COE_CHOICES: { value: Coe | null; label: string }[] = [
  { value: 90, label: 'COE 90' },
  { value: 96, label: 'COE 96' },
  { value: null, label: 'Not for fusing / not sure' },
];

export function GlassForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<GlassInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof GlassInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [usedMakers, setUsedMakers] = useState<string[]>([]);

  useEffect(() => {
    listManufacturers(db).then(setUsedMakers).catch(() => {});
  }, [db]);

  const set = <K extends keyof GlassInput>(key: K, value: GlassInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setKind = (kind: GlassKind) => {
    setInput((prev) => ({
      ...prev,
      kind,
      // Keep the unit if it still makes sense, otherwise use the usual one for that kind.
      unit: UNITS_FOR_KIND[kind].includes(prev.unit) ? prev.unit : UNITS_FOR_KIND[kind][0],
    }));
    setErrors((prev) => ({ ...prev, coe: undefined }));
  };

  const makerSuggestions = useMemo(() => {
    const all = [...new Set([...usedMakers, ...MANUFACTURERS])];
    const typed = input.manufacturer.trim().toLowerCase();
    return all
      .filter((m) => m.toLowerCase() !== typed && (typed === '' || m.toLowerCase().startsWith(typed)))
      .slice(0, 8);
  }, [usedMakers, input.manufacturer]);

  const save = async () => {
    const result = validateGlassInput(input);
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

  const errorCount = Object.values(errors).filter(Boolean).length;
  const showsType = input.kind === 'sheet' || input.kind === 'scrap';
  const unitWord = UNIT_LABELS[input.unit].one;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Column style={styles.form}>
          <View>
            <Label>What is it?</Label>
            <ChipRow>
              {GLASS_KINDS.map((k) => (
                <Chip key={k.value} label={k.label} selected={input.kind === k.value} onPress={() => setKind(k.value)} />
              ))}
            </ChipRow>
          </View>

          <Field
            label="Color name"
            placeholder="Deep Royal Blue Transparent"
            value={input.color_name}
            onChangeText={(t) => set('color_name', t)}
            error={errors.color_name}
            autoCapitalize="words"
          />

          <View style={styles.group}>
            <Field
              label="Maker"
              placeholder="Bullseye, Oceanside, Wissmach…"
              value={input.manufacturer}
              onChangeText={(t) => set('manufacturer', t)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {makerSuggestions.length > 0 && (
              <ChipRow>
                {makerSuggestions.map((m) => (
                  <Chip key={m} label={m} onPress={() => set('manufacturer', m)} />
                ))}
              </ChipRow>
            )}
          </View>

          <Field
            label="Product code"
            hint="Optional. The number on the label, like 001114."
            value={input.product_code}
            onChangeText={(t) => set('product_code', t)}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <View>
            <Label
              hint="Glass with different COEs can't be fused together. Stained glass that won't be fired doesn't need one."
              error={errors.coe}
            >
              COE
            </Label>
            <ChipRow>
              {COE_CHOICES.map((o) => (
                <Chip key={String(o.value)} label={o.label} selected={input.coe === o.value} onPress={() => set('coe', o.value)} />
              ))}
            </ChipRow>
          </View>

          {showsType && (
            <View>
              <Label>Type</Label>
              <ChipRow>
                {GLASS_TYPES.map((t) => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    selected={input.glass_type === t.value}
                    onPress={() => set('glass_type', input.glass_type === t.value ? null : t.value)}
                  />
                ))}
              </ChipRow>
            </View>
          )}

          <View>
            <Label hint="Used for filtering. Pick the closest.">Color family</Label>
            <ChipRow>
              {COLOR_FAMILIES.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  swatch={f.swatch}
                  selected={input.color_family === f.value}
                  onPress={() => set('color_family', input.color_family === f.value ? null : f.value)}
                />
              ))}
            </ChipRow>
          </View>

          <View style={styles.group}>
            <Field
              label="How much do you have?"
              hint="Fractions work too, like 1/2 or 1 1/4."
              value={input.quantity}
              onChangeText={(t) => set('quantity', t)}
              error={errors.quantity}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <ChipRow>
              {UNITS_FOR_KIND[input.kind].map((u) => (
                <Chip key={u} label={UNIT_LABELS[u].many} selected={input.unit === u} onPress={() => set('unit', u)} />
              ))}
            </ChipRow>
          </View>

          <Field
            label={`Price paid per ${unitWord}`}
            hint="Optional. Used later to work out what a piece costs to make."
            placeholder="0.00"
            value={input.cost}
            onChangeText={(t) => set('cost', t)}
            error={errors.cost}
            keyboardType="decimal-pad"
          />

          <PhotoSlot
            label={input.kind === 'sheet' ? 'Photo of the sheet' : `Photo of the ${kindLabel(input.kind).toLowerCase()}`}
            uri={input.photo_uri}
            onChange={(u) => set('photo_uri', u)}
          />

          {input.coe !== null && (
            <PhotoSlot
              label="How it looks fired"
              hint="Optional. Many colors change in the kiln."
              uri={input.fired_photo_uri}
              onChange={(u) => set('fired_photo_uri', u)}
            />
          )}

          <Field
            label="Notes"
            placeholder="Where it's stored, what it's good for, anything else"
            value={input.notes}
            onChangeText={(t) => set('notes', t)}
            multiline
          />

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
  summary: { fontSize: type.label, fontWeight: '700' },
  actions: { gap: space.sm },
});
