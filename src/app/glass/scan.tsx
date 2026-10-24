import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { CoeBadge } from '@/components/glass/CoeBadge';
import { GlassThumb } from '@/components/glass/GlassThumb';
import { Button, Column } from '@/components/ui';
import { findGlassByCode, linkBarcode, listGlass } from '@/db/glassRepo';
import type { GlassItem } from '@/db/types';
import { formatQuantity } from '@/domain/glass';
import { space, tapTarget, type, useColors } from '@/theme/theme';

type Step =
  | { name: 'scanning' }
  | { name: 'choose'; code: string; matches: GlassItem[] }
  | { name: 'unknown'; code: string }
  | { name: 'link'; code: string };

const openItem = (id: string) => router.replace({ pathname: '/glass/[id]', params: { id } });

export default function ScanGlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ name: 'scanning' });

  const lookUp = async (code: string) => {
    const matches = await findGlassByCode(db, code);
    if (matches.length === 1) openItem(matches[0].id);
    else if (matches.length > 1) setStep({ name: 'choose', code, matches });
    else setStep({ name: 'unknown', code });
  };

  if (step.name === 'link') {
    return <LinkToExisting code={step.code} onBack={() => setStep({ name: 'unknown', code: step.code })} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Column style={styles.stack}>
        {step.name === 'scanning' && <BarcodeScanner onCode={lookUp} onCancel={() => router.back()} />}

        {step.name === 'choose' && (
          <>
            <Text style={[styles.heading, { color: c.text }]}>Which one is it?</Text>
            <Text style={[styles.body, { color: c.muted }]}>More than one item has the code {step.code}.</Text>
            {step.matches.map((g) => (
              <GlassChoice key={g.id} item={g} onPress={() => openItem(g.id)} />
            ))}
            <Button label="Scan again" variant="secondary" onPress={() => setStep({ name: 'scanning' })} />
          </>
        )}

        {step.name === 'unknown' && (
          <>
            <Text style={[styles.heading, { color: c.text }]}>New barcode</Text>
            <Text style={[styles.body, { color: c.muted }]}>
              No glass has the code {step.code} yet. Add it as new glass, or link it to glass already in the inventory. After that, scanning this label brings it right up.
            </Text>
            <Button
              label="Add as new glass"
              onPress={() => router.replace({ pathname: '/glass/new', params: { barcode: step.code } })}
            />
            <Button label="Link to glass I already added" variant="secondary" onPress={() => setStep({ name: 'link', code: step.code })} />
            <Button label="Scan again" variant="secondary" onPress={() => setStep({ name: 'scanning' })} />
          </>
        )}
      </Column>
    </ScrollView>
  );
}

function LinkToExisting({ code, onBack }: { code: string; onBack: () => void }) {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<GlassItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    listGlass(db, { search }).then(setItems);
  }, [db, search]);

  const link = async (item: GlassItem) => {
    const result = await linkBarcode(db, item.id, code);
    if (result.linked) openItem(item.id);
    else setProblem(`That code already belongs to ${result.usedBy.color_name}.`);
  };

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={
        <Column style={styles.stack}>
          <Text style={[styles.heading, { color: c.text }]}>Link code {code}</Text>
          <Text style={[styles.body, { color: c.muted }]}>Tap the glass this label belongs to.</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search color, maker or code"
            placeholderTextColor={c.muted}
            accessibilityLabel="Search glass to link"
            style={[styles.search, { color: c.text, backgroundColor: c.input, borderColor: c.border }]}
          />
          {problem && <Text style={[styles.body, { color: c.danger }]}>{problem}</Text>}
        </Column>
      }
      renderItem={({ item }) => (
        <Column>
          <GlassChoice item={item} onPress={() => link(item)} />
        </Column>
      )}
      ListEmptyComponent={
        <Column>
          <Text style={[styles.body, { color: c.muted }]}>No glass matches.</Text>
        </Column>
      }
      ListFooterComponent={
        <Column style={styles.footer}>
          <Button label="Back" variant="secondary" onPress={onBack} />
        </Column>
      }
    />
  );
}

function GlassChoice({ item, onPress }: { item: GlassItem; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.choice, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <GlassThumb uri={item.photo_uri} family={item.color_family} size={52} />
      <View style={styles.choiceText}>
        <Text style={[styles.choiceTitle, { color: c.text }]}>{item.color_name}</Text>
        <View style={styles.choiceMeta}>
          <CoeBadge coe={item.coe} />
          <Text style={[styles.small, { color: c.muted }]} numberOfLines={1}>
            {[item.manufacturer, formatQuantity(item.quantity, item.unit)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.sm },
  stack: { gap: space.md },
  heading: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small, flexShrink: 1 },
  search: { minHeight: tapTarget, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, fontSize: type.body },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderWidth: 1, borderRadius: 12, marginBottom: space.sm },
  choiceText: { flex: 1, gap: 4, minWidth: 0 },
  choiceTitle: { fontSize: type.body, fontWeight: '700' },
  choiceMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { paddingTop: space.md },
});
