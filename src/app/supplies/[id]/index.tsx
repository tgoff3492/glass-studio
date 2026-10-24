import { Image } from 'expo-image';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuantityCard } from '@/components/QuantityCard';
import { ShoppingButton } from '@/components/ShoppingButton';
import { SupplyThumb } from '@/components/supplies/SupplyBits';
import { Button, Column } from '@/components/ui';
import { deleteSupply, getSupply, setSupplyQuantity } from '@/db/suppliesRepo';
import type { Supply } from '@/db/types';
import { UNIT_LABELS, formatQuantity } from '@/domain/glass';
import { categoryInfo, stockLevel, supplyTitle } from '@/domain/supplies';
import { deletePhoto } from '@/lib/photos';
import { space, type, useColors } from '@/theme/theme';

export default function SupplyDetailScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Supply | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSupply(db, id).then(setItem);
    }, [db, id]),
  );

  if (item === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (item === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={[styles.body, { color: c.muted }]}>{"This supply isn't in the inventory anymore."}</Text>
        <Button label="Back to supplies" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const changeQuantity = async (delta: number) => {
    const saved = await setSupplyQuantity(db, item.id, item.quantity + delta);
    setItem({ ...item, quantity: saved });
  };

  const remove = async () => {
    const result = await deleteSupply(db, item.id);
    if (result.deleted) {
      if (item.photo_uri) deletePhoto(item.photo_uri);
      router.back();
    } else {
      setConfirmDelete(false);
      setDeleteProblem(
        `${result.usedInProjects === 1 ? 'A project uses' : `${result.usedInProjects} projects use`} this supply, so it can't be deleted. Set the amount to 0 instead.`,
      );
    }
  };

  const level = stockLevel(item);
  const unit = UNIT_LABELS[item.unit];
  const status =
    level === 'out'
      ? { text: 'Out. It’s on the shopping list.', tone: 'danger' as const }
      : level === 'low'
        ? { text: 'Running low. It’s on the shopping list.', tone: 'warn' as const }
        : item.min_quantity !== null
          ? { text: `Goes on the shopping list at ${formatQuantity(item.min_quantity, item.unit)}.`, tone: 'muted' as const }
          : { text: 'No low-stock reminder set. Tap Edit to add one.', tone: 'muted' as const };

  const details: [string, string][] = [['Type', categoryInfo(item.category).label]];
  if (item.brand) details.push(['Brand', item.brand]);
  if (item.cost_per_unit_cents !== null) details.push([`Price per ${unit.one}`, `$${(item.cost_per_unit_cents / 100).toFixed(2)}`]);
  details.push(['Added', new Date(item.created_at).toLocaleDateString()]);

  const edit = () => router.push({ pathname: '/supplies/[id]/edit', params: { id: item.id } });

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
          headerRight: () => (
            <Pressable onPress={edit} accessibilityRole="button" hitSlop={12} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: c.accent }]}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}>
        <Column style={styles.stack}>
          {item.photo_uri ? (
            <Image source={{ uri: item.photo_uri }} style={[styles.photo, { borderColor: c.border }]} contentFit="cover" accessibilityLabel={item.name} />
          ) : null}

          <View style={styles.titleRow}>
            {!item.photo_uri && <SupplyThumb uri={null} category={item.category} size={64} />}
            <View style={styles.titleText}>
              <Text style={[styles.title, { color: c.text }]}>{item.name}</Text>
              {item.size && <Text style={[styles.body, { color: c.muted }]}>{item.size}</Text>}
            </View>
          </View>

          <QuantityCard quantity={item.quantity} unit={item.unit} onChange={changeQuantity} status={status} />

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {details.map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: c.muted }]}>{k}</Text>
                <Text style={[styles.detailValue, { color: c.text }]}>{v}</Text>
              </View>
            ))}
            {item.notes && (
              <View style={styles.notes}>
                <Text style={[styles.detailKey, { color: c.muted }]}>Notes</Text>
                <Text style={[styles.body, { color: c.text }]}>{item.notes}</Text>
              </View>
            )}
          </View>

          {level === 'ok' && <ShoppingButton sourceType="supply" sourceId={item.id} label={supplyTitle(item)} />}
          <Button label="Edit details" variant="secondary" onPress={edit} />

          {deleteProblem && <Text style={[styles.body, { color: c.danger }]}>{deleteProblem}</Text>}
          {confirmDelete ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.danger }]}>
              <Text style={[styles.body, { color: c.text }]}>{`Delete ${supplyTitle(item)}? This can't be undone.`}</Text>
              <Button label="Delete" variant="danger" onPress={remove} />
              <Button label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink}>
              <Text style={[styles.deleteText, { color: c.danger }]}>Delete this supply</Text>
            </Pressable>
          )}
        </Column>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  content: { padding: space.md },
  stack: { gap: space.lg },
  photo: { width: '100%', aspectRatio: 4 / 3, maxHeight: 360, borderRadius: 12, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleText: { flex: 1, gap: space.xs },
  title: { fontSize: type.title, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  card: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: space.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  detailKey: { fontSize: type.label, fontWeight: '600' },
  detailValue: { fontSize: type.label, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  notes: { gap: space.xs },
  headerButton: { paddingHorizontal: space.sm, minHeight: 44, justifyContent: 'center' },
  headerButtonText: { fontSize: type.body, fontWeight: '700' },
  deleteLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
  deleteText: { fontSize: type.label, fontWeight: '700' },
});
