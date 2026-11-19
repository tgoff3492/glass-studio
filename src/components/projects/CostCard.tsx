import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { ProjectGlassLine, ProjectSupplyLine } from '@/db/projectsRepo';
import { formatMoney, projectCost } from '@/domain/costing';
import { benchMinutes, formatMinutes } from '@/domain/projects';
import type { Project } from '@/db/types';
import { space, type, useColors } from '@/theme/theme';

/** What this piece cost: materials at the prices she entered, plus her time, and a starting price. */
export function CostCard({
  project,
  glass,
  supplies,
  pricing,
}: {
  project: Project;
  glass: ProjectGlassLine[];
  supplies: ProjectSupplyLine[];
  pricing: { hourlyCents: number | null; markupPercent: number | null };
}) {
  const c = useColors();
  const minutes = benchMinutes(project, new Date());
  if (glass.length === 0 && supplies.length === 0 && minutes === 0) return null;
  const cost = projectCost({ glass, supplies, minutes, ...pricing });

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.heading, { color: c.muted }]} accessibilityRole="header">
        WHAT IT COST
      </Text>
      <Row label="Materials" value={formatMoney(cost.materialsCents)} />
      {cost.unpriced.length > 0 && (
        <Text style={[styles.note, { color: c.muted }]}>{`No price yet for ${cost.unpriced.join(', ')}. Add one with Edit on that item.`}</Text>
      )}
      {cost.timeCents !== null ? (
        <Row label={`Time · ${formatMinutes(minutes)} at ${formatMoney(pricing.hourlyCents ?? 0)}/h`} value={formatMoney(cost.timeCents)} />
      ) : (
        <Text style={[styles.note, styles.link, { color: c.accent }]} onPress={() => router.push('/settings')} accessibilityRole="link">
          Set what your time is worth in Settings to count it here.
        </Text>
      )}
      <View style={[styles.rule, { backgroundColor: c.border }]} />
      <Row label="Total" value={formatMoney(cost.totalCents)} bold />
      {cost.priceCents !== null && <Row label={`Price with ${pricing.markupPercent}% added`} value={formatMoney(cost.priceCents)} bold accent />}
      {glass.some((g) => g.partial) && <Text style={[styles.note, { color: c.muted }]}>A sheet you cut from counts as the whole sheet.</Text>}
    </View>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.text }, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, { color: accent ? c.accent : c.text }, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: space.md, gap: space.sm },
  heading: { fontSize: type.small, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, alignItems: 'baseline' },
  label: { fontSize: type.label, flex: 1 },
  value: { fontSize: type.body, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
  note: { fontSize: type.small, lineHeight: type.small * 1.4 },
  link: { fontWeight: '600' },
  rule: { height: 1, marginVertical: space.xs },
});
