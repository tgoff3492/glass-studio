import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, ChipRow, Column, Field, Label } from '@/components/ui';
import { PROJECT_KINDS, validateProjectInput, type ProjectFields, type ProjectInput } from '@/domain/projects';
import { space, useColors } from '@/theme/theme';

type Props = {
  initial: ProjectInput;
  submitLabel: string;
  onSubmit: (fields: ProjectFields) => Promise<void>;
  onCancel: () => void;
};

export function ProjectForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const r = validateProjectInput(input);
    if (!r.ok) {
      setError(r.errors.name);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(r.value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Column style={styles.form}>
          <Field
            label="Project name"
            placeholder="Sunflower panel"
            value={input.name}
            onChangeText={(t) => {
              setInput({ ...input, name: t });
              setError(undefined);
            }}
            error={error}
            autoCapitalize="sentences"
          />
          <View>
            <Label hint="Fused projects get a kiln step and a COE check.">Kind of piece</Label>
            <ChipRow>
              {PROJECT_KINDS.map((k) => (
                <Chip key={k.value} label={k.label} selected={input.kind === k.value} onPress={() => setInput({ ...input, kind: k.value })} />
              ))}
            </ChipRow>
          </View>
          <Field
            label="Notes"
            placeholder="Who it's for, size, pattern source, ideas"
            value={input.notes}
            onChangeText={(t) => setInput({ ...input, notes: t })}
            multiline
          />
          <View style={styles.actions}>
            <Button label={saving ? 'Saving…' : submitLabel} onPress={save} disabled={saving} />
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
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
  actions: { gap: space.sm },
});
