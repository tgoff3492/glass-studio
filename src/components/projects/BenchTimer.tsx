import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { adjustMinutes, startTimer, stopTimer } from '@/db/projectsRepo';
import type { Project } from '@/db/types';
import { benchMinutes, formatMinutes } from '@/domain/projects';
import { space, type, useColors } from '@/theme/theme';

/** Time at the bench. Keeps running if she closes the app; later it feeds what a piece costs. */
export function BenchTimer({ project, onChange }: { project: Project; onChange: () => void }) {
  const db = useSQLiteContext();
  const c = useColors();
  const running = project.timer_started_at !== null;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [running]);

  const minutes = benchMinutes(project, running ? now : new Date(0));
  const act = (fn: () => Promise<void>) => async () => {
    await fn();
    setNow(new Date());
    onChange();
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: running ? c.accent : c.border }]}>
      <View style={styles.top}>
        <Ionicons name={running ? 'timer' : 'timer-outline'} size={28} color={running ? c.accent : c.muted} />
        <View style={styles.text}>
          <Text style={[styles.time, { color: c.text }]} accessibilityLiveRegion="polite">
            {minutes === 0 && !running ? 'No time logged yet' : formatMinutes(minutes)}
          </Text>
          <Text style={[styles.small, { color: c.muted }]}>
            {running ? 'Timer running — it keeps going if you close the app.' : 'Time at the bench'}
          </Text>
        </View>
      </View>
      <Button
        label={running ? 'Stop timer' : 'Start timer'}
        variant={running ? 'secondary' : 'primary'}
        onPress={act(() => (running ? stopTimer(db, project.id) : startTimer(db, project.id)))}
      />
      <View style={styles.adjust}>
        <Small label="− 15 min" onPress={act(() => adjustMinutes(db, project.id, -15))} a11y="Take off 15 minutes" />
        <Small label="+ 15 min" onPress={act(() => adjustMinutes(db, project.id, 15))} a11y="Add 15 minutes" />
        <Small label="+ 1 hour" onPress={act(() => adjustMinutes(db, project.id, 60))} a11y="Add an hour" />
      </View>
    </View>
  );
}

function Small({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.smallButton, { borderColor: c.border, backgroundColor: c.accentSoft, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.smallText, { color: c.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 14, padding: space.md, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  time: { fontSize: type.heading, fontWeight: '700', fontVariant: ['tabular-nums'] },
  small: { fontSize: type.small },
  adjust: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  smallButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  smallText: { fontSize: type.label, fontWeight: '700' },
});
