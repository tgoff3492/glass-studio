import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { StockBadge, SupplyThumb } from '@/components/supplies/SupplyBits';
import { Button, Chip, Column } from '@/components/ui';
import { listSupplies } from '@/db/suppliesRepo';
import type { Supply } from '@/db/types';
import { formatQuantity } from '@/domain/glass';
import { SUPPLY_GROUPS, categoryInfo, type SupplyGroup } from '@/domain/supplies';
import { space, tapTarget, type, useColors } from '@/theme/theme';

/** The Supplies side of the Inventory tab: search, filters and the list. */
export function SupplyInventory() {
  const db = useSQLiteContext();
  const c = useColors();
  const [items, setItems] = useState<Supply[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<SupplyGroup | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const loadCounts = useCallback(async () => {
    const all = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM supplies');
    setTotal(all?.n ?? 0);
  }, [db]);

  const load = useCallback(async () => {
    setItems(await listSupplies(db, { search, group, lowOnly }));
    await loadCounts();
  }, [db, search, group, lowOnly, loadCounts]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtering = Boolean(search.trim() || group || lowOnly);
  const clearFilters = () => {
    setSearch('');
    setGroup(null);
    setLowOnly(false);
  };

  return (
    <View style={styles.safe}>
        <FlatList
          data={items ?? []}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            total > 0 ? (
              <Column style={styles.filters}>
                <View style={[styles.search, { backgroundColor: c.input, borderColor: c.border }]}>
                  <Ionicons name="search" size={22} color={c.muted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search name, size or brand"
                    placeholderTextColor={c.muted}
                    style={[styles.searchInput, { color: c.text }]}
                    accessibilityLabel="Search supplies"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                  <Chip label="Everything" selected={!group && !lowOnly} onPress={() => { setGroup(null); setLowOnly(false); }} />
                  <Chip label="Running low" selected={lowOnly} onPress={() => setLowOnly(!lowOnly)} />
                  {SUPPLY_GROUPS.map((g) => (
                    <Chip key={g.value} label={g.label} selected={group === g.value} onPress={() => setGroup(group === g.value ? null : g.value)} />
                  ))}
                </ScrollView>
                {filtering && items && (
                  <View style={styles.countRow}>
                    <Text style={[styles.count, { color: c.muted }]}>{`${items.length} of ${total} shown`}</Text>
                    <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={12}>
                      <Text style={[styles.clear, { color: c.accent }]}>Clear filters</Text>
                    </Pressable>
                  </View>
                )}
              </Column>
            ) : undefined
          }
          ItemSeparatorComponent={() => (
            <Column>
              <View style={[styles.sep, { backgroundColor: c.border }]} />
            </Column>
          )}
          renderItem={({ item }) => <SupplyRow item={item} />}
          ListEmptyComponent={
            items === null ? undefined : total === 0 ? (
              <Column style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No supplies yet</Text>
                <Text style={[styles.body, { color: c.muted }]}>
                  {"Add foil, solder, kiln wash and the rest. Set a reminder amount on each, and they'll go on the shopping list when they run low."}
                </Text>
                <Button label="Add your first supply" onPress={() => router.push('/supplies/new')} />
              </Column>
            ) : (
              <Column style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>{lowOnly && !search && !group ? 'Nothing is running low' : 'Nothing matches'}</Text>
                <Button label="Clear filters" variant="secondary" onPress={clearFilters} />
              </Column>
            )
          }
        />
    </View>
  );
}

function SupplyRow({ item }: { item: Supply }) {
  const c = useColors();
  const sub = [item.size, item.brand].filter(Boolean).join(' · ') || categoryInfo(item.category).label;
  return (
    <Column>
      <Pressable
        onPress={() => router.push({ pathname: '/supplies/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <SupplyThumb uri={item.photo_uri} category={item.category} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
            {sub}
          </Text>
          <StockBadge quantity={item.quantity} min={item.min_quantity} />
        </View>
        <Text style={[styles.qty, { color: item.quantity === 0 ? c.danger : c.text }]}>
          {item.quantity === 0 ? 'Out' : formatQuantity(item.quantity, item.unit)}
        </Text>
      </Pressable>
    </Column>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  addButton: { minHeight: 48, paddingHorizontal: space.md },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentText: { fontSize: type.label, fontWeight: '700' },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, flexGrow: 1 },
  filters: { gap: space.sm, paddingTop: space.md, paddingBottom: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, minHeight: tapTarget },
  searchInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  chips: { gap: space.sm, paddingRight: space.md },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: type.small },
  clear: { fontSize: type.label, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: tapTarget },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '700' },
  rowSub: { fontSize: type.label },
  qty: { fontSize: type.label, fontWeight: '700', textAlign: 'right', maxWidth: 110, fontVariant: ['tabular-nums'] },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { gap: space.md, paddingTop: space.xl },
  emptyTitle: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
});
