import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SupplyThumb } from '@/components/supplies/SupplyBits';
import { Button, Column, Field } from '@/components/ui';
import { takeSupply } from '@/db/projectsRepo';
import { listSupplies } from '@/db/suppliesRepo';
import type { Supply } from '@/db/types';
import { UNIT_LABELS, formatQuantity, parseAmount } from '@/domain/glass';
import { supplyTitle } from '@/domain/supplies';
import { space, tapTarget, type, useColors } from '@/theme/theme';

export default function UseSupplyScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Supply[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSupplies(db, { search }).then(setItems);
  }, [db, search]);

  const use = async (s: Supply) => {
    const q = parseAmount(qty);
    if (q === null || q <= 0) return setError('Enter how much you used.');
    const r = await takeSupply(db, id, s.id, q);
    if (r.ok) router.back();
    else setError(r.message);
  };

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <Column style={styles.header}>
          <View style={[styles.search, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="search" size={22} color={c.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search supplies"
              placeholderTextColor={c.muted}
              accessibilityLabel="Search supplies to use"
              style={[styles.searchInput, { color: c.text }]}
            />
          </View>
        </Column>
      }
      renderItem={({ item }) => (
        <Column>
          <Pressable
            onPress={() => {
              setSelected(selected === item.id ? null : item.id);
              setQty('');
              setError(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              { borderColor: selected === item.id ? c.accent : c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <SupplyThumb uri={item.photo_uri} category={item.category} size={48} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: c.text }]}>{supplyTitle(item)}</Text>
              <Text style={[styles.small, { color: item.quantity <= 0 ? c.danger : c.muted }]}>
                {item.quantity <= 0 ? 'None left' : formatQuantity(item.quantity, item.unit)}
              </Text>
            </View>
          </Pressable>
          {selected === item.id && item.quantity > 0 && (
            <View style={[styles.panel, { borderColor: c.accent, backgroundColor: c.surface }]}>
              <Field
                label={`How many ${UNIT_LABELS[item.unit].many} did you use?`}
                hint={`You have ${formatQuantity(item.quantity, item.unit)}. Fractions work, like 1/2.`}
                value={qty}
                onChangeText={(t) => {
                  setQty(t);
                  setError(null);
                }}
                keyboardType="decimal-pad"
                autoFocus
              />
              {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
              <Button label="Use this supply" onPress={() => use(item)} />
            </View>
          )}
        </Column>
      )}
      ListEmptyComponent={
        <Column>
          <Text style={[styles.body, { color: c.muted }]}>{search ? 'No supplies match.' : 'No supplies yet. Add some in the Supplies tab first.'}</Text>
        </Column>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.sm },
  header: { marginBottom: space.sm },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, minHeight: tapTarget },
  searchInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderWidth: 1.5, borderRadius: 12, marginBottom: space.sm },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '700' },
  panel: { borderWidth: 1.5, borderRadius: 12, padding: space.md, gap: space.md, marginBottom: space.md, marginTop: -space.xs },
  error: { fontSize: type.label, fontWeight: '700' },
});
