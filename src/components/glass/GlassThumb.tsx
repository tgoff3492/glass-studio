import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colorFamily } from '@/domain/glass';
import { useColors } from '@/theme/theme';

/** The item's photo, or its color family swatch when there's no photo yet. */
export function GlassThumb({ uri, family, size = 64 }: { uri: string | null; family: string | null; size?: number }) {
  const c = useColors();
  const box = { width: size, height: size, borderRadius: 10, borderColor: c.border };
  if (uri) {
    return <Image source={{ uri }} style={[styles.thumb, box]} contentFit="cover" accessibilityIgnoresInvertColors />;
  }
  return <View style={[styles.thumb, box, { backgroundColor: colorFamily(family)?.swatch ?? c.border }]} />;
}

const styles = StyleSheet.create({
  thumb: { borderWidth: 1 },
});
