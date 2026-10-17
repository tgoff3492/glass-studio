import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, type, useColors } from '@/theme/theme';

type Props = {
  title: string;
  phase: string;
  summary: string;
  features: string[];
  children?: React.ReactNode;
};

/** Placeholder for a section that isn't built yet. Says plainly what is coming. */
export function ComingSoon({ title, phase, summary, features, children }: Props) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.phase, { color: c.accent }]}>{phase}</Text>
          <Text style={[styles.summary, { color: c.muted }]}>{summary}</Text>
          {children}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {features.map((f) => (
              <View key={f} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: c.accent }]} />
                <Text style={[styles.feature, { color: c.text }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: space.lg, alignItems: 'center' },
  // Keeps lines a comfortable length on iPad.
  column: { width: '100%', maxWidth: 640, gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  phase: { fontSize: type.label, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  summary: { fontSize: type.body, lineHeight: type.body * 1.4 },
  card: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: space.md },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 9 },
  feature: { flex: 1, fontSize: type.body, lineHeight: type.body * 1.35 },
});
