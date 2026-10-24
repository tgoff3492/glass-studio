import { StyleSheet, Text, View } from 'react-native';

import type { Coe } from '@/db/types';
import { coeLabel } from '@/domain/glass';
import { type, useColors } from '@/theme/theme';

/** COE shown the same way everywhere, so 90 and 96 are never confused. */
export function CoeBadge({ coe, large }: { coe: Coe | null; large?: boolean }) {
  const c = useColors();
  const color = coe === 90 ? c.coe90 : coe === 96 ? c.coe96 : c.muted;
  return (
    <View
      style={[styles.badge, large && styles.large, { borderColor: color }]}
      accessibilityLabel={coe === null ? 'No COE recorded' : `C O E ${coe}`}
    >
      <Text style={[styles.text, large && styles.largeText, { color }]}>{coeLabel(coe)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  large: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: type.small, fontWeight: '800', letterSpacing: 0.3 },
  largeText: { fontSize: type.label },
});
