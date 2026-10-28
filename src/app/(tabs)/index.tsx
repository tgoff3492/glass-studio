import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassInventory } from '@/components/inventory/GlassInventory';
import { SupplyInventory } from '@/components/inventory/SupplyInventory';
import { Button, Column } from '@/components/ui';
import { space, type, useColors } from '@/theme/theme';

type Side = 'glass' | 'supplies';

/** Everything in the studio: glass on one side, the supplies it takes to work it on the other. */
export default function InventoryScreen() {
  const c = useColors();
  const [side, setSide] = useState<Side>('glass');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Column style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            Inventory
          </Text>
          <View style={styles.actions}>
            {side === 'glass' && (
              <Pressable
                onPress={() => router.push('/glass/scan')}
                accessibilityRole="button"
                accessibilityLabel="Scan a barcode"
                style={({ pressed }) => [styles.scanButton, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="barcode-outline" size={24} color={c.accent} />
                <Text style={[styles.scanText, { color: c.accent }]}>Scan</Text>
              </Pressable>
            )}
            <Button
              label="+ Add"
              onPress={() => router.push(side === 'glass' ? '/glass/new' : '/supplies/new')}
              style={styles.addButton}
              accessibilityHint={side === 'glass' ? 'Add glass' : 'Add a supply'}
            />
          </View>
        </View>
        <View style={[styles.segment, { backgroundColor: c.accentSoft }]} accessibilityRole="tablist">
          <Segment label="Glass" selected={side === 'glass'} onPress={() => setSide('glass')} />
          <Segment label="Supplies" selected={side === 'supplies'} onPress={() => setSide('supplies')} />
        </View>
      </Column>
      {side === 'glass' ? <GlassInventory /> : <SupplyInventory />}
    </SafeAreaView>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.segmentItem, selected && { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text style={[styles.segmentText, { color: selected ? c.text : c.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addButton: { minHeight: 48, paddingHorizontal: space.md },
  scanButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1 },
  scanText: { fontSize: type.body, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentText: { fontSize: type.label, fontWeight: '700' },
});
