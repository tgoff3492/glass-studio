import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoeBadge } from '@/components/glass/CoeBadge';
import { GlassThumb } from '@/components/glass/GlassThumb';
import { Button, Chip, Column } from '@/components/ui';
import { listGlass } from '@/db/glassRepo';
import type { Coe, GlassItem, GlassKind } from '@/db/types';
import { COLOR_FAMILIES, GLASS_KINDS, formatQuantity, kindLabel } from '@/domain/glass';
import { space, tapTarget, type, useColors } from '@/theme/theme';

const COE_FILTERS: { value: Coe | 'none' | null; label: string }[] = [
  { value: null, label: 'Any COE' },
  { value: 90, label: 'COE 90' },
  { value: 96, label: 'COE 96' },
  { value: 'none', label: 'No COE' },
];

export default function GlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const [items, setItems] = useState<GlassItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<GlassKind | null>(null);
  const [coe, setCoe] = useState<Coe | 'none' | null>(null);
  const [family, setFamily] = useState<string | null>(null);

  const filtering = Boolean(search.trim() || kind || coe || family);

  const load = useCallback(async () => {
    const [rows, all] = await Promise.all([
      listGlass(db, { search, kind, coe, colorFamily: family }),
      db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM glass_items'),
    ]);
    setItems(rows);
    setTotal(all?.n ?? 0);
  }, [db, search, kind, coe, family]);

  // Reload whenever the tab comes back into view, e.g. after adding or editing.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const clearFilters = () => {
    setSearch('');
    setKind(null);
    setCoe(null);
    setFamily(null);
  };

  const filters = (
    <View style={styles.filters}>
      <FilterRow>
        <Chip label="All glass" selected={kind === null} onPress={() => setKind(null)} />
        {GLASS_KINDS.map((k) => (
          <Chip key={k.value} label={k.plural} selected={kind === k.value} onPress={() => setKind(kind === k.value ? null : k.value)} />
        ))}
      </FilterRow>
      <FilterRow>
        {COE_FILTERS.map((f) => (
          <Chip key={String(f.value)} label={f.label} selected={coe === f.value} onPress={() => setCoe(f.value)} />
        ))}
      </FilterRow>
      <FilterRow>
        <Chip label="Any color" selected={family === null} onPress={() => setFamily(null)} />
        {COLOR_FAMILIES.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            swatch={f.swatch}
            selected={family === f.value}
            onPress={() => setFamily(family === f.value ? null : f.value)}
          />
        ))}
      </FilterRow>
      {items !== null && total > 0 && (
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: c.muted }]}>
            {filtering ? `${items.length} of ${total} shown` : `${total} ${total === 1 ? 'item' : 'items'}`}
          </Text>
          {filtering && (
            <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={12}>
              <Text style={[styles.clear, { color: c.accent }]}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Column style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            Glass
          </Text>
          <View style={styles.titleActions}>
            <Pressable
              onPress={() => router.push('/glass/scan')}
              accessibilityRole="button"
              accessibilityLabel="Scan a barcode"
              style={({ pressed }) => [styles.scanButton, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="barcode-outline" size={24} color={c.accent} />
              <Text style={[styles.scanText, { color: c.accent }]}>Scan</Text>
            </Pressable>
            <Button label="+ Add" onPress={() => router.push('/glass/new')} style={styles.addButton} accessibilityHint="Add glass" />
          </View>
        </View>
        <View style={[styles.search, { backgroundColor: c.input, borderColor: c.border }]}>
          <Ionicons name="search" size={22} color={c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search color, maker, code or size"
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.text }]}
            accessibilityLabel="Search glass"
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </Column>

      <FlatList
        data={items ?? []}
        keyExtractor={(g) => g.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={total > 0 ? <Column>{filters}</Column> : undefined}
        ItemSeparatorComponent={() => <Column><View style={[styles.sep, { backgroundColor: c.border }]} /></Column>}
        renderItem={({ item }) => <GlassRow item={item} />}
        ListEmptyComponent={
          items === null ? undefined : total === 0 ? (
            <Empty
              title="No glass yet"
              body="Add each sheet, jar of frit and bin of scrap. You'll be able to search it all by color, maker or COE."
              action={<Button label="Add your first glass" onPress={() => router.push('/glass/new')} />}
            />
          ) : (
            <Empty
              title="Nothing matches"
              body="Try a different word, or clear the filters to see everything."
              action={<Button label="Clear filters" variant="secondary" onPress={clearFilters} />}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

function GlassRow({ item }: { item: GlassItem }) {
  const c = useColors();
  const maker = [item.manufacturer, item.product_code].filter(Boolean).join(' · ');
  const empty = item.quantity === 0;
  return (
    <Column>
      <Pressable
        onPress={() => router.push({ pathname: '/glass/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.color_name}, ${maker}, ${formatQuantity(item.quantity, item.unit)}`}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <GlassThumb uri={item.photo_uri} family={item.color_family} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
            {item.color_name}
          </Text>
          {maker !== '' && (
            <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
              {maker}
            </Text>
          )}
          {item.size_summary && (
            <Text style={[styles.rowSizes, { color: c.text }]} numberOfLines={2}>
              {item.size_summary}
            </Text>
          )}
          <View style={styles.badges}>
            <CoeBadge coe={item.coe} />
            <Text style={[styles.kind, { color: c.muted }]}>{kindLabel(item.kind)}</Text>
          </View>
        </View>
        <Text style={[styles.qty, { color: empty ? c.danger : c.text }]}>
          {empty ? 'Out' : formatQuantity(item.quantity, item.unit)}
        </Text>
      </Pressable>
    </Column>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  const c = useColors();
  return (
    <Column style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: c.muted }]}>{body}</Text>
      {action}
    </Column>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addButton: { minHeight: 48, paddingHorizontal: space.md },
  scanButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1 },
  scanText: { fontSize: type.body, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: space.md,
    minHeight: tapTarget,
  },
  searchInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, flexGrow: 1 },
  filters: { gap: space.sm, paddingTop: space.md, paddingBottom: space.sm },
  filterRow: { gap: space.sm, paddingRight: space.md },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.xs },
  count: { fontSize: type.small },
  clear: { fontSize: type.label, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: tapTarget },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '700' },
  rowSub: { fontSize: type.label },
  rowSizes: { fontSize: type.label, fontWeight: '600', fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  kind: { fontSize: type.small, fontWeight: '600' },
  qty: { fontSize: type.label, fontWeight: '700', textAlign: 'right', maxWidth: 110, fontVariant: ['tabular-nums'] },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { gap: space.md, paddingTop: space.xl, alignItems: 'stretch' },
  emptyTitle: { fontSize: type.heading, fontWeight: '700' },
  emptyBody: { fontSize: type.body, lineHeight: type.body * 1.4 },
});
