import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShoppingList } from '@/components/supplies/ShoppingList';
import { Column } from '@/components/ui';
import { space, type, useColors } from '@/theme/theme';

export default function ShoppingScreen() {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Column style={styles.top}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Shopping list
        </Text>
      </Column>
      <ShoppingList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
});
