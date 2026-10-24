import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { SupplyCategory } from '@/db/types';
import { stockLevel, type StockLevel } from '@/domain/supplies';
import { type, useColors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<SupplyCategory, IconName> = {
  foil: 'disc-outline',
  solder: 'flash-outline',
  came: 'remove-outline',
  flux: 'water-outline',
  patina: 'color-palette-outline',
  grinder_bit: 'cog-outline',
  cutter: 'cut-outline',
  kiln_wash: 'brush-outline',
  fiber_paper: 'document-outline',
  shelf_paper: 'documents-outline',
  mold: 'square-outline',
  dichroic: 'diamond-outline',
  other: 'cube-outline',
};

/** The supply's photo, or an icon for its category. */
export function SupplyThumb({ uri, category, size = 56 }: { uri: string | null; category: SupplyCategory; size?: number }) {
  const c = useColors();
  const box = { width: size, height: size, borderRadius: 10, borderColor: c.border };
  if (uri) return <Image source={{ uri }} style={[styles.thumb, box]} contentFit="cover" />;
  return (
    <View style={[styles.thumb, styles.icon, box, { backgroundColor: c.accentSoft }]}>
      <Ionicons name={ICONS[category]} size={size * 0.5} color={c.accent} />
    </View>
  );
}

/** "Low" or "Out", shown only when it matters. */
export function StockBadge({ quantity, min }: { quantity: number; min: number | null }) {
  const c = useColors();
  const level: StockLevel = stockLevel({ quantity, min_quantity: min });
  if (level === 'ok') return null;
  const color = level === 'out' ? c.danger : c.coe96;
  return (
    <View style={[styles.badge, { borderColor: color }]} accessibilityLabel={level === 'out' ? 'Out of stock' : 'Running low'}>
      <Text style={[styles.badgeText, { color }]}>{level === 'out' ? 'OUT' : 'LOW'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderWidth: 1 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: type.small, fontWeight: '800', letterSpacing: 0.5 },
});
