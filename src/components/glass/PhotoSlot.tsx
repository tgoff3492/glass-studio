import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Label } from '@/components/ui';
import { addPhoto, photoProblem, type PhotoSource } from '@/lib/photos';
import { space, type, useColors } from '@/theme/theme';

type Props = {
  label: string;
  hint?: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
};

/** One photo in a form: shows it, or offers to take or choose one. */
export function PhotoSlot({ label, hint, uri, onChange }: Props) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (source: PhotoSource) => {
    setProblem(null);
    setBusy(true);
    const result = await addPhoto(source);
    setBusy(false);
    if (result.status === 'saved') onChange(result.uri);
    else setProblem(photoProblem(result));
  };

  return (
    <View style={styles.slot}>
      <Label hint={hint} error={problem ?? undefined}>
        {label}
      </Label>
      {uri ? (
        <Image source={{ uri }} style={[styles.photo, { borderColor: c.border }]} contentFit="cover" accessibilityLabel={label} />
      ) : (
        <View style={[styles.photo, styles.placeholder, { borderColor: c.border, backgroundColor: c.surface }]}>
          {busy ? <ActivityIndicator color={c.accent} /> : <Text style={[styles.none, { color: c.muted }]}>No photo yet</Text>}
        </View>
      )}
      <View style={styles.buttons}>
        <Button label="Take photo" variant="secondary" onPress={() => pick('camera')} disabled={busy} style={styles.button} />
        <Button label={uri ? 'Replace' : 'Choose photo'} variant="secondary" onPress={() => pick('library')} disabled={busy} style={styles.button} />
        {uri && <Button label="Remove" variant="secondary" onPress={() => onChange(null)} disabled={busy} style={styles.button} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { gap: space.sm },
  photo: { width: '100%', aspectRatio: 4 / 3, maxHeight: 320, borderRadius: 12, borderWidth: 1 },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  none: { fontSize: type.label },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  button: { flexGrow: 1, paddingHorizontal: space.md },
});
