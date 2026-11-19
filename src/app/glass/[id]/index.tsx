import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoeBadge } from '@/components/glass/CoeBadge';
import { GlassThumb } from '@/components/glass/GlassThumb';
import { AddSize, SizeRow, SizeTotals } from '@/components/glass/SizeRows';
import { QuantityCard } from '@/components/QuantityCard';
import { ShoppingButton } from '@/components/ShoppingButton';
import { ScreenOptions, useDetailId, useLeave } from '@/components/split';
import { Button, Column } from '@/components/ui';
import { changeGlassSize, deleteGlass, getGlass, listGlassSizes, setGlassQuantity } from '@/db/glassRepo';
import { projectsUsingGlass } from '@/db/projectsRepo';
import { glassScopes } from '@/db/undoRepo';
import { useUndo } from '@/components/Undo';
import { StatusPill } from '@/components/projects/ProjectBits';
import type { GlassItem, ProjectKind, ProjectStatus } from '@/db/types';
import { formatQuantity, UNIT_LABELS, colorFamily, kindLabel, typeLabel } from '@/domain/glass';
import { normalizeSize, sizeLabel, type SheetSize } from '@/domain/sizes';
import { discardPhotos } from '@/lib/photoCleanup';
import { space, type, useColors } from '@/theme/theme';
import { photoUri } from '@/lib/photoUri';

export default function GlassDetailScreen() {
  const db = useSQLiteContext();
  const undo = useUndo();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const id = useDetailId();
  const leave = useLeave();
  const [item, setItem] = useState<GlassItem | null | undefined>(undefined);
  const [sizes, setSizes] = useState<SheetSize[]>([]);
  const [usedIn, setUsedIn] = useState<{ id: string; name: string; status: ProjectStatus; kind: ProjectKind }[]>([]);
  const [addingSize, setAddingSize] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getGlass(db, id), listGlassSizes(db, id), projectsUsingGlass(db, id)]).then(([g, z, p]) => {
        setItem(g);
        setSizes(z);
        setUsedIn(p);
      });
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
        <ScreenOptions options={{ title: 'Not found' }} />
        <Text style={[styles.body, { color: c.muted }]}>{"This glass isn't in the inventory anymore."}</Text>
        <Button label="Back to glass" variant="secondary" onPress={() => leave()} />
      </View>
    );
  }

  const reload = async () => {
    setSizes(await listGlassSizes(db, item.id));
    setItem(await getGlass(db, item.id));
  };

  const changeSizeCount = (width: number, height: number, delta: number) =>
    undo.run({
      key: `glass:${item.id}`,
      scopes: glassScopes(item.id),
      after: reload,
      change: async () => {
        const next = await changeGlassSize(db, item.id, width, height, delta);
        setSizes(next);
        const fresh = await getGlass(db, item.id);
        setItem(fresh);
        const [w, h] = normalizeSize(width, height);
        const n = next.find((s) => s.width === w && s.height === h)?.count ?? 0;
        return `${item.color_name}: ${n} × ${sizeLabel(width, height)}`;
      },
    });

  const changeQuantity = (delta: number) =>
    undo.run({
      key: `glass:${item.id}`,
      scopes: glassScopes(item.id),
      after: reload,
      change: async () => {
        const saved = await setGlassQuantity(db, item.id, item.quantity + delta);
        setItem({ ...item, quantity: saved });
        return `${item.color_name}: ${formatQuantity(saved, item.unit)}`;
      },
    });

  const remove = async () => {
    const result = await deleteGlass(db, item.id);
    if (result.deleted) {
      discardPhotos(item);
      leave();
    } else {
      setConfirmDelete(false);
      setDeleteProblem(
        `${result.usedInProjects === 1 ? 'A project uses' : `${result.usedInProjects} projects use`} this glass (listed under Used in), so it can't be deleted. Set the amount to 0 instead.`,
      );
    }
  };

  const maker = [item.manufacturer, item.product_code].filter(Boolean).join(' · ');
  const family = colorFamily(item.color_family);
  const glassType = typeLabel(item.glass_type);
  const details: [string, string][] = [];
  if (family) details.push(['Color family', family.label]);
  if (item.cost_per_unit_cents !== null) {
    details.push([`Price per ${UNIT_LABELS[item.unit].one}`, `$${(item.cost_per_unit_cents / 100).toFixed(2)}`]);
  }
  if (item.min_quantity !== null) details.push(['Remind me at', formatQuantity(item.min_quantity, item.size_summary ? 'sheet' : item.unit)]);
  if (item.barcode) details.push(['Barcode', item.barcode]);
  details.push(['Added', new Date(item.created_at).toLocaleDateString()]);

  return (
    <>
      <ScreenOptions
        options={{
          title: item.color_name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/glass/[id]/edit', params: { id: item.id } })}
              accessibilityRole="button"
              hitSlop={12}
              style={styles.headerButton}
            >
              <Text style={[styles.headerButtonText, { color: c.accent }]}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
      >
        <Column style={styles.stack}>
          {item.photo_uri || item.fired_photo_uri ? (
            <View style={styles.photos}>
              {item.photo_uri && <Photo uri={item.photo_uri} caption={item.fired_photo_uri ? 'Before firing' : undefined} />}
              {item.fired_photo_uri && <Photo uri={item.fired_photo_uri} caption="Fired" />}
            </View>
          ) : (
            <View style={styles.noPhoto}>
              <GlassThumb uri={null} family={item.color_family} size={72} />
              <Text style={[styles.small, { color: c.muted }]}>No photo yet. Tap Edit to add one.</Text>
            </View>
          )}

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: c.text }]}>{item.color_name}</Text>
            {maker !== '' && <Text style={[styles.body, { color: c.muted }]}>{maker}</Text>}
            <View style={styles.badges}>
              <CoeBadge coe={item.coe} large />
              <Text style={[styles.tag, { color: c.muted }]}>{kindLabel(item.kind)}</Text>
              {glassType && <Text style={[styles.tag, { color: c.muted }]}>{glassType}</Text>}
            </View>
          </View>

          {sizes.length > 0 ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.cardLabel, { color: c.muted }]}>ON HAND BY SIZE</Text>
              {sizes.map((s) => (
                <SizeRow key={`${s.width}x${s.height}`} size={s} onChange={(d) => changeSizeCount(s.width, s.height, d)} />
              ))}
              <SizeTotals sizes={sizes} />
              {addingSize ? (
                <AddSize
                  existing={sizes}
                  onAdd={async (w, h) => {
                    await changeSizeCount(w, h, 1);
                    setAddingSize(false);
                  }}
                />
              ) : (
                <Pressable onPress={() => setAddingSize(true)} accessibilityRole="button" style={styles.addSize}>
                  <Text style={[styles.addSizeText, { color: c.accent }]}>+ Add a size</Text>
                </Pressable>
              )}
              <Text style={[styles.small, { color: c.muted }]}>Cut a sheet down? Take one from its size and add the pieces you kept.</Text>
            </View>
          ) : (
            <QuantityCard quantity={item.quantity} unit={item.unit} onChange={changeQuantity} />
          )}

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

          {usedIn.length > 0 && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.cardLabel, { color: c.muted }]}>USED IN</Text>
              {usedIn.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/projects/[id]', params: { id: p.id } })}
                  accessibilityRole="button"
                  style={styles.usedRow}
                >
                  <Text style={[styles.usedName, { color: c.accent }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <StatusPill kind={p.kind} status={p.status} />
                </Pressable>
              ))}
            </View>
          )}

          <ShoppingButton
            sourceType="glass"
            sourceId={item.id}
            label={[item.manufacturer, item.color_name, item.product_code && `(${item.product_code})`].filter(Boolean).join(' ')}
          />
          <Button label="Edit details" variant="secondary" onPress={() => router.push({ pathname: '/glass/[id]/edit', params: { id: item.id } })} />
          <Button
            label="Add another like this"
            variant="secondary"
            accessibilityHint="Starts new glass with the same color, maker and COE"
            onPress={() => router.push({ pathname: '/glass/new', params: { copyFrom: item.id } })}
          />

          {deleteProblem && <Text style={[styles.body, { color: c.danger }]}>{deleteProblem}</Text>}
          {confirmDelete ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.danger }]}>
              <Text style={[styles.body, { color: c.text }]}>
                {`Delete ${item.color_name} from the inventory? This can't be undone.`}
              </Text>
              <Button label="Delete" variant="danger" onPress={remove} />
              <Button label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink}>
              <Text style={[styles.deleteText, { color: c.danger }]}>Delete this glass</Text>
            </Pressable>
          )}
        </Column>
      </ScrollView>
    </>
  );
}

function Photo({ uri, caption }: { uri: string; caption?: string }) {
  const c = useColors();
  return (
    <View style={styles.photoBox}>
      <Image source={{ uri: photoUri(uri) }} style={[styles.photo, { borderColor: c.border }]} contentFit="cover" accessibilityLabel={caption ?? 'Photo'} />
      {caption && <Text style={[styles.small, { color: c.muted }]}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cardLabel: { fontSize: type.small, fontWeight: '700', letterSpacing: 0.8 },
  addSize: { minHeight: 44, justifyContent: 'center' },
  usedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  usedName: { flex: 1, fontSize: type.body, fontWeight: '700' },
  addSizeText: { fontSize: type.label, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  content: { padding: space.md },
  stack: { gap: space.lg },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  photoBox: { flexGrow: 1, flexBasis: 280, gap: space.xs },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, borderWidth: 1 },
  noPhoto: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleBlock: { gap: space.xs },
  title: { fontSize: type.title, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, marginTop: space.xs },
  tag: { fontSize: type.label, fontWeight: '600' },
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
