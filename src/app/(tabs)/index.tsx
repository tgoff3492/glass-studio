import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassInventory } from '@/components/inventory/GlassInventory';
import { SupplyInventory } from '@/components/inventory/SupplyInventory';
import { Button, Column } from '@/components/ui';
import { SETTING, countEverything, getSetting } from '@/db/settingsRepo';
import { backupIsDue, describeLastBackup } from '@/domain/backupFormat';
import { backupsSupported } from '@/lib/backup';
import { space, type, useColors } from '@/theme/theme';
import { SplitView } from '@/components/split';
import GlassDetailScreen from '@/app/glass/[id]/index';
import SupplyDetailScreen from '@/app/supplies/[id]/index';

type Side = 'glass' | 'supplies';

/** Everything in the studio: glass on one side, the supplies it takes to work it on the other. */
export default function InventoryScreen() {
  const c = useColors();
  const [side, setSide] = useState<Side>('glass');
  const backupNudge = useBackupNudge();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <SplitView
        emptyText="Choose glass or a supply to see it here."
        renderDetail={(s) => (s.kind === 'glass' ? <GlassDetailScreen /> : <SupplyDetailScreen />)}
        list={
          <View style={styles.flex}>
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
              {backupNudge && (
                <Pressable
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.nudge, { backgroundColor: c.surface, borderColor: c.coe96, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color={c.coe96} />
                  <Text style={[styles.nudgeText, { color: c.text }]}>
                    {backupNudge === 'never' ? 'You haven’t saved a backup yet.' : `Last backup: ${backupNudge}.`} Tap to save one.
                  </Text>
                </Pressable>
              )}
              <View style={[styles.segment, { backgroundColor: c.accentSoft }]} accessibilityRole="tablist">
                <Segment label="Glass" selected={side === 'glass'} onPress={() => setSide('glass')} />
                <Segment label="Supplies" selected={side === 'supplies'} onPress={() => setSide('supplies')} />
              </View>
            </Column>
            {side === 'glass' ? <GlassInventory /> : <SupplyInventory />}
          </View>
        }
      />
    </SafeAreaView>
  );
}

/** When a backup is overdue, what to say about the last one; otherwise null. */
function useBackupNudge(): string | null {
  const db = useSQLiteContext();
  const [nudge, setNudge] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!backupsSupported) return;
      Promise.all([getSetting(db, SETTING.lastBackupAt), countEverything(db)])
        .then(([last, n]) => {
          const now = new Date();
          setNudge(backupIsDue(last, n.glass + n.supplies + n.projects, now) ? describeLastBackup(last, now) : null);
        })
        .catch(() => {});
    }, [db]),
  );
  return nudge;
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
  flex: { flex: 1 },
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 12, padding: space.md },
  nudgeText: { flex: 1, fontSize: type.label, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addButton: { minHeight: 48, paddingHorizontal: space.md },
  scanButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1 },
  scanText: { fontSize: type.body, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentText: { fontSize: type.label, fontWeight: '700' },
});
