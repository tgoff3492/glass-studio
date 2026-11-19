import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Column } from '@/components/ui';
import { getProject, makeAgain, planRepeat, type RepeatPlan } from '@/db/projectsRepo';
import type { Project } from '@/db/types';
import { shoppingChanged } from '@/lib/shoppingCount';
import { space, type, useColors } from '@/theme/theme';

/** "Make this again": what it takes, what she has, and a button to start the copy. */
export default function MakeAgainScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [plan, setPlan] = useState<RepeatPlan | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getProject(db, id), planRepeat(db, id)]).then(([p, r]) => {
      setProject(p);
      setPlan(r);
    });
  }, [db, id]);

  if (!project || !plan) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const start = async () => {
    setBusy(true);
    const r = await makeAgain(db, id);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    shoppingChanged();
    router.dismiss();
    router.push({ pathname: '/projects/[id]', params: { id: r.id } });
  };

  const empty = plan.lines.length === 0;
  const cuts = plan.lines.some((l) => l.cut);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}>
      <Column style={styles.stack}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {project.name}
        </Text>
        {empty ? (
          <Text style={[styles.body, { color: c.text }]}>
            This project has no glass or supplies on it yet, so there’s nothing to copy. Add what it used, then come back.
          </Text>
        ) : (
          <>
            <View style={[styles.verdict, { backgroundColor: plan.canMake > 0 ? c.accentSoft : c.surface, borderColor: c.border }]}>
              <Text style={[styles.big, { color: plan.canMake > 0 ? c.text : c.danger }]}>
                {plan.canMake === 0 ? 'Not enough to make another' : `Enough to make ${plan.canMake} more`}
              </Text>
            </View>
            {plan.lines.map((l, i) => (
              <View key={i} style={[styles.row, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Ionicons
                  name={l.times > 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={26}
                  color={l.times > 0 ? c.coe90 : c.danger}
                  accessibilityLabel={l.times > 0 ? 'Enough' : 'Not enough'}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{l.label}</Text>
                  <Text style={[styles.small, { color: c.muted }]}>{`${l.need} · ${l.have}`}</Text>
                </View>
              </View>
            ))}
            {cuts && (
              <Text style={[styles.small, { color: c.muted }]}>
                Sheets you cut from aren’t taken now. They’re listed in the new project’s notes; use “Part of a sheet” when you cut them, so you can
                say what’s left.
              </Text>
            )}
            {problem && <Text style={[styles.body, styles.bold, { color: c.danger }]}>{problem}</Text>}
            <Button
              label={busy ? 'Starting…' : 'Start a new one'}
              onPress={start}
              disabled={busy || plan.canMake < 1}
              accessibilityHint="Makes a copy of this project and takes the same glass and supplies from inventory"
            />
            <Text style={[styles.small, { color: c.muted }]}>
              The glass and supplies come out of your inventory, just like using them on a project.
            </Text>
          </>
        )}
      </Column>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.md },
  stack: { gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  bold: { fontWeight: '700' },
  verdict: { borderWidth: 1, borderRadius: 14, padding: space.md },
  big: { fontSize: type.heading, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: 12, padding: space.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: type.label, fontWeight: '700' },
  small: { fontSize: type.small, lineHeight: type.small * 1.4 },
});
