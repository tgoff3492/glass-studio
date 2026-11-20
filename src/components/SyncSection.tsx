import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { describeLastBackup } from '@/domain/backupFormat';
import { createAccount, onSyncStatus, resetPassword, signIn, signOut, syncNow, type SyncStatus } from '@/lib/sync/manager';
import { space, type, useColors } from '@/theme/theme';

/** "Your iPhone and iPad": sign in once on each, and everything stays in step. */
export function SyncSection() {
  const c = useColors();
  const [s, setS] = useState<SyncStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => onSyncStatus(setS), []);

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; message: string }>, success?: string) => {
    setBusy(true);
    setMessage(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setMessage({ text: r.message, good: false });
    else if (success) setMessage({ text: success, good: true });
    if (r.ok) setPassword('');
  };

  const other = Platform.OS === 'ios' && Platform.isPad ? 'iPhone' : 'iPad';

  if (!s) return null;

  if (s.signedIn) {
    const when = s.lastSyncedAt ? describeLastBackup(s.lastSyncedAt, new Date()) : null;
    const line =
      s.phase === 'syncing'
        ? `Syncing${s.pending > 0 ? ` ${s.pending} ${s.pending === 1 ? 'change' : 'changes'}` : ''}…`
        : s.phase === 'offline'
          ? `Offline. ${s.pending > 0 ? `${s.pending} ${s.pending === 1 ? 'change waits' : 'changes wait'} to sync; ` : ''}they'll go when you're back online.`
          : `Up to date${when ? ` · checked ${when === 'today' ? 'today' : when}` : ''}`;
    return (
      <View style={styles.stack}>
        <Text style={[styles.body, { color: c.text }]}>
          Signed in as <Text style={styles.bold}>{s.email}</Text>. Changes here show up on your {other}, and the other way around.
        </Text>
        <View style={styles.statusRow}>
          {s.phase === 'syncing' && <ActivityIndicator color={c.accent} />}
          <Text style={[styles.body, styles.bold, { color: s.phase === 'offline' ? c.coe96 : c.text }]} accessibilityLiveRegion="polite">
            {line}
          </Text>
        </View>
        {s.photoNote && <Text style={[styles.small, { color: c.muted }]}>{s.photoNote}</Text>}
        <Button label="Sync now" variant="secondary" onPress={() => syncNow()} />
        {confirmOut ? (
          <View style={[styles.confirm, { borderColor: c.border }]}>
            <Text style={[styles.body, { color: c.text }]}>
              Sign out on this device? Everything stays here, but changes stop syncing until you sign in again.
            </Text>
            <Button
              label="Sign out"
              variant="danger"
              onPress={async () => {
                setConfirmOut(false);
                await signOut();
              }}
            />
            <Button label="Stay signed in" variant="secondary" onPress={() => setConfirmOut(false)} />
          </View>
        ) : (
          <Button label="Sign out" variant="secondary" onPress={() => setConfirmOut(true)} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.body, { color: c.text }]}>
        Sign in with the same email on your iPhone and your iPad, and your glass, supplies, projects and photos stay the same on both. They’re also
        kept safe online if a device is lost.
      </Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Password"
        hint="At least 6 characters."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
      />
      {busy ? (
        <ActivityIndicator color={c.accent} />
      ) : (
        <>
          <Button label="Sign in" onPress={() => run(() => signIn(email, password))} disabled={!email.trim() || !password} />
          <Button
            label="Create an account"
            variant="secondary"
            onPress={() => run(() => createAccount(email, password))}
            disabled={!email.trim() || password.length < 6}
          />
          <Text
            style={[styles.link, { color: c.accent }]}
            accessibilityRole="button"
            onPress={() =>
              email.trim()
                ? run(() => resetPassword(email), `We sent a link to ${email.trim()} to choose a new password.`)
                : setMessage({ text: 'Type your email first, then tap “Forgot password?”.', good: false })
            }
          >
            Forgot password?
          </Text>
        </>
      )}
      {message && (
        <Text style={[styles.body, styles.bold, { color: message.good ? c.coe90 : c.danger }]} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small, lineHeight: type.small * 1.4 },
  bold: { fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  link: { fontSize: type.label, fontWeight: '700', paddingVertical: space.sm },
  confirm: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: space.sm },
});
