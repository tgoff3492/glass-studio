import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Column } from '@/components/ui';
import { SETTING, countEverything, getSetting } from '@/db/settingsRepo';
import { describeLastBackup } from '@/domain/backupFormat';
import { backupsSupported, restoreBackup, shareBackup } from '@/lib/backup';
import { space, type, useColors } from '@/theme/theme';

type Counts = Awaited<ReturnType<typeof countEverything>>;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState<null | 'saving' | 'restoring'>(null);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const load = useCallback(async () => {
    const [last, n] = await Promise.all([getSetting(db, SETTING.lastBackupAt), countEverything(db)]);
    setLastBackup(last);
    setCounts(n);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    setMessage(null);
    setBusy('saving');
    const r = await shareBackup(db);
    setBusy(null);
    setMessage(
      r.status === 'shared'
        ? { text: 'Backup made. Keep that file somewhere safe, like iCloud Drive.', good: true }
        : { text: r.message, good: false },
    );
    load();
  };

  const restore = async () => {
    setConfirmRestore(false);
    setMessage(null);
    setBusy('restoring');
    const r = await restoreBackup(db);
    setBusy(null);
    if (r.status === 'restored') {
      const { glass, projects } = r.info.counts;
      setMessage({ text: `Restored: ${glass} glass and ${projects} projects from ${r.info.createdAt.slice(0, 10)}.`, good: true });
    } else if (r.status === 'failed') setMessage({ text: r.message, good: false });
    load();
  };

  const version = Constants.expoConfig?.version ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Column style={styles.stack}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            Settings
          </Text>
          <Section title="Keep your work safe">
            <Text style={[styles.body, { color: c.text }]}>
              A backup is one file with everything in it: glass, supplies, projects and photos. Save it to iCloud Drive (“Save to Files”) or send it
              to Taylor. If this {deviceWord()} is ever lost or replaced, the backup brings it all back.
            </Text>
            <Text style={[styles.status, { color: c.text }]}>
              Last backup: <Text style={styles.bold}>{describeLastBackup(lastBackup, new Date())}</Text>
            </Text>
            {counts && (
              <Text style={[styles.small, { color: c.muted }]}>
                {`${counts.glass} glass · ${counts.supplies} supplies · ${counts.projects} projects`}
              </Text>
            )}
            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={c.accent} />
                <Text style={[styles.body, { color: c.text }]}>{busy === 'saving' ? 'Making the backup…' : 'Restoring…'}</Text>
              </View>
            ) : (
              <View style={styles.buttons}>
                <Button label="Save a backup" onPress={save} disabled={!backupsSupported} />
                <Button label="Restore from a backup" variant="secondary" onPress={() => setConfirmRestore(true)} disabled={!backupsSupported} />
              </View>
            )}
            {!backupsSupported && (
              <Text style={[styles.small, { color: c.muted }]}>
                Backups work in the iPhone and iPad app. This web preview keeps its data in this browser only.
              </Text>
            )}
            {message && (
              <Text style={[styles.body, styles.bold, { color: message.good ? c.coe90 : c.danger }]} accessibilityLiveRegion="polite">
                {message.text}
              </Text>
            )}
            <Text style={[styles.small, { color: c.muted }]}>
              The app also keeps a copy of your records on this {deviceWord()} every week and before each update, and the {deviceWord()}’s own iCloud
              backup includes your photos.
            </Text>
          </Section>

          <Section title="Help">
            <Button label="Send Taylor a note" variant="secondary" onPress={() => router.push('/feedback')} />
            <Button label="Play the welcome again" variant="secondary" onPress={() => router.push('/welcome')} />
          </Section>

          <Text style={[styles.small, styles.center, { color: c.muted }]}>{`Glass Studio ${version}\nMade for Kathryn, with love, by Taylor.`}</Text>
        </Column>

        <Modal visible={confirmRestore} transparent animationType="fade" onRequestClose={() => setConfirmRestore(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.dialogTitle, { color: c.text }]}>Replace everything with a backup?</Text>
              <Text style={[styles.body, { color: c.text }]}>
                Everything in the app now is swapped for what’s in the backup you pick. What’s here now is saved first, so Taylor can bring it back if
                you pick the wrong file.
              </Text>
              <Button label="Choose a backup file" onPress={restore} />
              <Button label="Cancel" variant="secondary" onPress={() => setConfirmRestore(false)} />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function deviceWord() {
  if (Platform.OS !== 'ios') return 'device';
  return Platform.isPad ? 'iPad' : 'iPhone';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: space.md, paddingBottom: space.xl },
  title: { fontSize: type.title, fontWeight: '700' },
  stack: { gap: space.lg },
  section: { borderWidth: 1, borderRadius: 16, padding: space.md, gap: space.md },
  sectionTitle: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  status: { fontSize: type.body },
  bold: { fontWeight: '700' },
  small: { fontSize: type.small, lineHeight: type.small * 1.4 },
  center: { textAlign: 'center' },
  buttons: { gap: space.sm },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.lg },
  dialog: { borderRadius: 16, borderWidth: 1, padding: space.lg, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  dialogTitle: { fontSize: type.heading, fontWeight: '700' },
});
