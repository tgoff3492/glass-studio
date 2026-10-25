import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { ProjectKind, ProjectStatus } from '@/db/types';
import { statusLabel, type CoeWarning } from '@/domain/projects';
import { space, type, useColors } from '@/theme/theme';

/** Status as a small pill. Done reads green, everything in progress reads blue. */
export function StatusPill({ kind, status }: { kind: ProjectKind; status: ProjectStatus }) {
  const c = useColors();
  const done = status === 'done';
  const color = done ? c.coe90 : status === 'idea' ? c.muted : c.accent;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{statusLabel(kind, status)}</Text>
    </View>
  );
}

export function ProjectThumb({ uri, kind, size = 64 }: { uri: string | null; kind: ProjectKind; size?: number }) {
  const c = useColors();
  const box = { width: size, height: size, borderRadius: 10, borderColor: c.border };
  if (uri) return <Image source={{ uri }} style={[styles.thumb, box]} contentFit="cover" />;
  return (
    <View style={[styles.thumb, styles.icon, box, { backgroundColor: c.accentSoft }]}>
      <Ionicons name={kind === 'fused' ? 'flame-outline' : 'grid-outline'} size={size * 0.45} color={c.accent} />
    </View>
  );
}

/** The fused-glass COE warning, in plain words. */
export function CoeBanner({ warning }: { warning: CoeWarning }) {
  const c = useColors();
  if (!warning) return null;
  const mixed = warning.kind === 'mixed';
  const color = mixed ? c.danger : c.coe96;
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: c.surface }]} accessibilityRole="alert">
      <Ionicons name={mixed ? 'warning' : 'help-circle-outline'} size={26} color={color} />
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color }]}>{mixed ? 'COE 90 and 96 are mixed' : 'Check the COE'}</Text>
        <Text style={[styles.bannerBody, { color: c.text }]}>
          {mixed
            ? 'This piece has both COE 90 and COE 96 glass. Fused together, they will crack as they cool. Put back the glass that doesn’t match.'
            : `No COE is recorded for ${warning.names.join(', ')}. Make sure it matches the rest before firing.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: type.small, fontWeight: '800' },
  thumb: { borderWidth: 1 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', gap: space.md, borderWidth: 2, borderRadius: 12, padding: space.md, alignItems: 'flex-start' },
  bannerText: { flex: 1, gap: space.xs },
  bannerTitle: { fontSize: type.body, fontWeight: '800' },
  bannerBody: { fontSize: type.label, lineHeight: type.label * 1.4 },
});
