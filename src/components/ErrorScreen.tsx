import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Column } from '@/components/ui';
import { logError } from '@/lib/errorLog';
import { sendNote } from '@/lib/feedback';
import { space, type, useColors } from '@/theme/theme';

/** Shown instead of a screen that crashed. Her data is in the database, so nothing is lost. */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const c = useColors();
  useEffect(() => {
    logError(error, 'screen');
  }, [error]);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Column style={styles.stack}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Something went wrong on this screen
        </Text>
        <Text style={[styles.body, { color: c.text }]}>
          Your glass, supplies and projects are safe. Try again, and if it keeps happening, send Taylor a note so he can fix it.
        </Text>
        <View style={styles.buttons}>
          <Button label="Try again" onPress={() => retry()} />
          <Button label="Send Taylor a note" variant="secondary" onPress={() => sendNote(`This screen broke: ${error.message}`)} />
        </View>
      </Column>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  stack: { gap: space.md },
  title: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  buttons: { gap: space.sm, marginTop: space.sm },
});
