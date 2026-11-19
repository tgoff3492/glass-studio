import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Column, Field } from '@/components/ui';
import { sendNote } from '@/lib/feedback';
import { addPhoto, deletePhoto, photoProblem } from '@/lib/photos';
import { photoUri } from '@/lib/photoUri';
import { space, type, useColors } from '@/theme/theme';

/** "Send Taylor a note": what went wrong or what would help, plus a screenshot if she has one. */
export default function FeedbackScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async () => {
    setProblem(null);
    const r = await addPhoto('library');
    if (r.status === 'saved') {
      if (shot) deletePhoto(shot);
      setShot(r.uri);
    } else setProblem(photoProblem(r));
  };

  const send = async () => {
    const sent = await sendNote(note, shot ? photoUri(shot) : null);
    if (sent) {
      if (shot) deletePhoto(shot);
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Column style={styles.stack}>
          <Text style={[styles.body, { color: c.text }]}>
            Tell Taylor what happened, what’s confusing, or what you wish the app did. Nothing is too small.
          </Text>
          <Field label="Your note" multiline value={note} onChangeText={setNote} placeholder="When I tried to…" autoFocus />
          <Text style={[styles.small, { color: c.muted }]}>
            To include a screenshot, press the side button and volume up together first, then add it here.
          </Text>
          {shot ? (
            <View style={styles.shotRow}>
              <Image
                source={{ uri: photoUri(shot) }}
                style={[styles.shot, { borderColor: c.border }]}
                contentFit="cover"
                accessibilityLabel="Screenshot"
              />
              <Button
                label="Remove"
                variant="secondary"
                onPress={() => {
                  deletePhoto(shot);
                  setShot(null);
                }}
              />
            </View>
          ) : (
            <Button label="Add a screenshot or photo" variant="secondary" onPress={pick} />
          )}
          {problem && <Text style={[styles.small, { color: c.danger }]}>{problem}</Text>}
          <Button label="Send" onPress={send} disabled={note.trim() === '' && !shot} />
          <Text style={[styles.small, { color: c.muted }]}>
            You’ll pick how to send it: Messages, Mail, or anything else. The app version and any recent problems are added at the end so Taylor can
            find the cause.
          </Text>
        </Column>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.md },
  stack: { gap: space.md },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small, lineHeight: type.small * 1.4 },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shot: { width: 96, height: 160, borderRadius: 10, borderWidth: 1 },
});
