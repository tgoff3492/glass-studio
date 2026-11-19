import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassThumb } from '@/components/glass/GlassThumb';
import { SupplyThumb } from '@/components/supplies/SupplyBits';
import { Button, Column } from '@/components/ui';
import { useUndo } from '@/components/Undo';
import { listLowGlass } from '@/db/glassRepo';
import { shoppingItemScopes } from '@/db/undoRepo';
import { addShoppingItem, clearDoneShopping, deleteShoppingItem, listShopping, setShoppingDone } from '@/db/shoppingRepo';
import { listSupplies } from '@/db/suppliesRepo';
import type { GlassItem, ShoppingItem, Supply } from '@/db/types';
import { formatQuantity } from '@/domain/glass';
import { shoppingChanged } from '@/lib/shoppingCount';
import { lowStockNote, supplyTitle } from '@/domain/supplies';
import { space, tapTarget, type, useColors } from '@/theme/theme';

/** Running-low supplies (automatic) plus anything she adds herself. */
export function ShoppingList({ onChanged }: { onChanged?: () => void }) {
  const db = useSQLiteContext();
  const undo = useUndo();
  const c = useColors();
  const [low, setLow] = useState<Supply[]>([]);
  const [lowGlass, setLowGlass] = useState<GlassItem[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const [l, g, i] = await Promise.all([listSupplies(db, { lowOnly: true }), listLowGlass(db), listShopping(db)]);
    setLow(l);
    setLowGlass(g);
    setItems(i);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changed = async () => {
    await load();
    shoppingChanged();
    onChanged?.();
  };

  const add = async () => {
    if (draft.trim() === '') return;
    await addShoppingItem(db, { label: draft });
    setDraft('');
    await changed();
  };

  const toBuy = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const empty = low.length === 0 && lowGlass.length === 0 && items.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Column style={styles.stack}>
        <View style={[styles.addRow, { backgroundColor: c.input, borderColor: c.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add something to buy"
            placeholderTextColor={c.muted}
            accessibilityLabel="Add something to buy"
            style={[styles.addInput, { color: c.text }]}
            returnKeyType="done"
            onSubmitEditing={add}
            blurOnSubmit={false}
          />
          <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Add to list" hitSlop={8} style={styles.addButton} disabled={draft.trim() === ''}>
            <Ionicons name="add-circle" size={36} color={draft.trim() === '' ? c.border : c.accent} />
          </Pressable>
        </View>

        {empty && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing to buy</Text>
            <Text style={[styles.body, { color: c.muted }]}>
              Supplies and glass with a “remind me” amount show up here on their own when they run low. You can also add glass from its page, or type anything above.
            </Text>
          </View>
        )}

        {(low.length > 0 || lowGlass.length > 0) && (
          <Section title="Running low" hint="These come off the list when you restock them.">
            {lowGlass.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push({ pathname: '/glass/[id]', params: { id: g.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              >
                <GlassThumb uri={g.photo_uri} family={g.color_family} size={44} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{[g.manufacturer, g.color_name].filter(Boolean).join(' ')}</Text>
                  <Text style={[styles.rowSub, { color: g.quantity <= 0 ? c.danger : c.coe96 }]}>
                    {g.quantity <= 0 ? 'All gone' : `${formatQuantity(g.quantity, g.unit)} left`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={c.muted} />
              </Pressable>
            ))}
            {low.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/supplies/[id]', params: { id: s.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              >
                <SupplyThumb uri={s.photo_uri} category={s.category} size={44} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{supplyTitle(s)}</Text>
                  <Text style={[styles.rowSub, { color: s.quantity <= 0 ? c.danger : c.coe96 }]}>{lowStockNote(s)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={c.muted} />
              </Pressable>
            ))}
          </Section>
        )}

        {toBuy.length > 0 && (
          <Section title="To buy">
            {toBuy.map((i) => (
              <ItemRow key={i.id} item={i} onChange={changed} />
            ))}
          </Section>
        )}

        {done.length > 0 && (
          <Section title="Got it">
            {done.map((i) => (
              <ItemRow key={i.id} item={i} onChange={changed} />
            ))}
            <Button
              label="Clear checked items"
              variant="secondary"
              onPress={() => {
                const doneIds = items.filter((i) => i.done).map((i) => i.id);
                return undo.run({
                  key: 'shop:clear',
                  scopes: shoppingItemScopes(doneIds),
                  after: changed,
                  change: async () => {
                    const n = await clearDoneShopping(db);
                    await changed();
                    return `Cleared ${n} checked ${n === 1 ? 'item' : 'items'}`;
                  },
                });
              }}
            />
          </Section>
        )}
      </Column>
    </ScrollView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.muted }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {hint && <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

function ItemRow({ item, onChange }: { item: ShoppingItem; onChange: () => void }) {
  const db = useSQLiteContext();
  const undo = useUndo();
  const c = useColors();
  const done = item.done === 1;
  const openSource = () => {
    if (item.source_type === 'glass' && item.source_id) router.push({ pathname: '/glass/[id]', params: { id: item.source_id } });
    if (item.source_type === 'supply' && item.source_id) router.push({ pathname: '/supplies/[id]', params: { id: item.source_id } });
  };
  return (
    <View style={styles.row}>
      <Pressable
        onPress={async () => {
          await setShoppingDone(db, item.id, !done);
          onChange();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={item.label}
        hitSlop={8}
        style={styles.check}
      >
        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={30} color={done ? c.muted : c.accent} />
      </Pressable>
      <Pressable onPress={openSource} disabled={!item.source_id} style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: done ? c.muted : c.text }, done && styles.struck]}>{item.label}</Text>
        {item.note && <Text style={[styles.rowSub, { color: c.muted }]}>{item.note}</Text>}
        {item.source_id && !done && <Text style={[styles.link, { color: c.accent }]}>{item.source_type === 'glass' ? 'Open glass' : 'Open supply'}</Text>}
      </Pressable>
      <Pressable
        onPress={() =>
          undo.run({
            key: `shop:${item.id}`,
            scopes: shoppingItemScopes([item.id]),
            after: onChange,
            change: async () => {
              await deleteShoppingItem(db, item.id);
              onChange();
              return `Took ${item.label} off the list`;
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.label}`}
        hitSlop={8}
        style={styles.remove}
      >
        <Ionicons name="close" size={24} color={c.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  stack: { gap: space.lg },
  addRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingLeft: space.md, minHeight: tapTarget },
  addInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  addButton: { paddingHorizontal: space.sm, minHeight: tapTarget, justifyContent: 'center' },
  empty: { gap: space.sm, paddingTop: space.md },
  emptyTitle: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  section: { gap: space.sm },
  sectionTitle: { fontSize: type.small, fontWeight: '800', letterSpacing: 0.8 },
  hint: { fontSize: type.small },
  card: { borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: space.xs, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: tapTarget, paddingVertical: space.sm },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '600' },
  rowSub: { fontSize: type.small, fontWeight: '600' },
  link: { fontSize: type.small, fontWeight: '700' },
  struck: { textDecorationLine: 'line-through' },
  check: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
