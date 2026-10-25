import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoeBadge } from '@/components/glass/CoeBadge';
import { GlassThumb } from '@/components/glass/GlassThumb';
import { Button, Chip, ChipRow, Column, Field } from '@/components/ui';
import { listGlass, listGlassSizes } from '@/db/glassRepo';
import { getProject, listProjectGlass, takeGlass } from '@/db/projectsRepo';
import type { Coe, GlassItem, Project } from '@/db/types';
import { UNIT_LABELS, formatQuantity, parseAmount } from '@/domain/glass';
import { wouldMixCoe } from '@/domain/projects';
import { sizeLabel, type SheetSize } from '@/domain/sizes';
import { space, tapTarget, type, useColors } from '@/theme/theme';

export default function UseGlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [usedCoes, setUsedCoes] = useState<(Coe | null)[]>([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<GlassItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getProject(db, id).then(setProject);
    listProjectGlass(db, id).then((lines) => setUsedCoes(lines.map((l) => l.coe)));
  }, [db, id]);

  useEffect(() => {
    listGlass(db, { search }).then(setItems);
  }, [db, search]);

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={
        <Column style={styles.header}>
          <Text style={[styles.body, { color: c.muted }]}>
            Tap the glass, then say how much. It comes out of your inventory, and “Put back” on the project returns it.
          </Text>
          <View style={[styles.search, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="search" size={22} color={c.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search color, maker, code or size"
              placeholderTextColor={c.muted}
              accessibilityLabel="Search glass to use"
              style={[styles.searchInput, { color: c.text }]}
            />
          </View>
        </Column>
      }
      renderItem={({ item }) => (
        <Column>
          <Pressable
            onPress={() => setSelected(selected === item.id ? null : item.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: selected === item.id }}
            style={({ pressed }) => [
              styles.row,
              { borderColor: selected === item.id ? c.accent : c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <GlassThumb uri={item.photo_uri} family={item.color_family} size={52} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: c.text }]}>{item.color_name}</Text>
              <View style={styles.rowMeta}>
                <CoeBadge coe={item.coe} />
                <Text style={[styles.small, { color: item.quantity <= 0 ? c.danger : c.muted }]} numberOfLines={2}>
                  {item.quantity <= 0 ? 'None left' : item.size_summary ?? formatQuantity(item.quantity, item.unit)}
                </Text>
              </View>
            </View>
          </Pressable>
          {selected === item.id && project && (
            <AmountPanel
              glass={item}
              mixWarning={project.kind === 'fused' && wouldMixCoe(usedCoes, item.coe) ? (usedCoes.find((x) => x !== null) as Coe) : null}
              onUse={async (amount) => {
                const r = await takeGlass(db, id, item.id, amount);
                if (r.ok) router.back();
                return r.ok ? null : r.message;
              }}
            />
          )}
        </Column>
      )}
      ListEmptyComponent={
        <Column>
          <Text style={[styles.body, { color: c.muted }]}>{search ? 'No glass matches.' : 'No glass in the inventory yet. Add some in the Glass tab first.'}</Text>
        </Column>
      }
    />
  );
}

type Amount = { size: { width: number; height: number }; count: number } | { quantity: number };

function AmountPanel({
  glass,
  mixWarning,
  onUse,
}: {
  glass: GlassItem;
  /** The project's existing COE, when this glass doesn't match it. */
  mixWarning: Coe | null;
  onUse: (amount: Amount) => Promise<string | null>;
}) {
  const db = useSQLiteContext();
  const c = useColors();
  const [sizes, setSizes] = useState<SheetSize[] | null>(null);
  const [size, setSize] = useState<SheetSize | null>(null);
  const [count, setCount] = useState(1);
  const [qty, setQty] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGlassSizes(db, glass.id).then((all) => {
      setSizes(all);
      const firstWithStock = all.find((s) => s.count > 0) ?? null;
      setSize(firstWithStock);
    });
  }, [db, glass.id]);

  if (sizes === null) return null;
  if (glass.quantity <= 0) {
    return (
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.body, { color: c.muted }]}>{"There's none of this left. Update the amount on its glass page if that's wrong."}</Text>
      </View>
    );
  }

  const bySize = sizes.length > 0;
  const submit = async () => {
    setError(null);
    if (bySize) {
      if (!size) return setError('Choose a size.');
      setError(await onUse({ size: { width: size.width, height: size.height }, count }));
    } else {
      const q = parseAmount(qty);
      if (q === null || q <= 0) return setError('Enter how much you used.');
      setError(await onUse({ quantity: q }));
    }
  };

  return (
    <View style={[styles.panel, { borderColor: c.accent, backgroundColor: c.surface }]}>
      {mixWarning !== null && (
        <View style={[styles.warn, { borderColor: c.danger }]} accessibilityRole="alert">
          <Ionicons name="warning" size={22} color={c.danger} />
          <Text style={[styles.warnText, { color: c.text }]}>
            {`This is COE ${glass.coe}, but the project already has COE ${mixWarning} glass. Fused together they will crack.`}
          </Text>
        </View>
      )}
      {bySize ? (
        <>
          <Text style={[styles.label, { color: c.text }]}>Which size?</Text>
          <ChipRow>
            {sizes
              .filter((s) => s.count > 0)
              .map((s) => (
                <Chip
                  key={`${s.width}x${s.height}`}
                  label={`${sizeLabel(s.width, s.height)} (${s.count})`}
                  selected={size?.width === s.width && size?.height === s.height}
                  onPress={() => {
                    setSize(s);
                    setCount(1);
                  }}
                />
              ))}
          </ChipRow>
          {size && (
            <View style={styles.counter}>
              <Text style={[styles.label, { color: c.text }]}>How many?</Text>
              <View style={styles.counterButtons}>
                <Round icon="remove" label="One fewer" onPress={() => setCount(Math.max(1, count - 1))} disabled={count <= 1} />
                <Text style={[styles.count, { color: c.text }]}>{count}</Text>
                <Round icon="add" label="One more" onPress={() => setCount(Math.min(size.count, count + 1))} disabled={count >= size.count} />
              </View>
            </View>
          )}
        </>
      ) : (
        <Field
          label={`How many ${UNIT_LABELS[glass.unit].many} did you use?`}
          hint={`You have ${formatQuantity(glass.quantity, glass.unit)}.`}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          autoFocus
        />
      )}
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
      <Button
        label={
          mixWarning !== null
            ? 'Use it anyway'
            : bySize && size
              ? `Use ${count} × ${sizeLabel(size.width, size.height)}`
              : 'Use this glass'
        }
        variant={mixWarning !== null ? 'danger' : 'primary'}
        onPress={submit}
      />
    </View>
  );
}

function Round({ icon, label, onPress, disabled }: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { borderColor: c.border, backgroundColor: c.accentSoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={24} color={c.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.sm },
  header: { gap: space.md, marginBottom: space.sm },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small, flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, minHeight: tapTarget },
  searchInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderWidth: 1.5, borderRadius: 12, marginBottom: space.sm },
  rowText: { flex: 1, gap: 4, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  panel: { borderWidth: 1.5, borderRadius: 12, padding: space.md, gap: space.md, marginBottom: space.md, marginTop: -space.xs },
  warn: { flexDirection: 'row', gap: space.sm, borderWidth: 1.5, borderRadius: 10, padding: space.sm, alignItems: 'flex-start' },
  warnText: { flex: 1, fontSize: type.label, lineHeight: type.label * 1.4 },
  label: { fontSize: type.label, fontWeight: '700' },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterButtons: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  count: { fontSize: type.heading, fontWeight: '700', minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: type.label, fontWeight: '700' },
});
