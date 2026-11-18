import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoeBadge } from '@/components/glass/CoeBadge';
import { Field } from '@/components/ui';
import { searchCatalog, type CatalogGlass } from '@/domain/catalog';
import { colorFamily, typeLabel } from '@/domain/glass';
import { space, tapTarget, type, useColors } from '@/theme/theme';

/** "Look it up": type a code or a color and pick the glass, and the form fills itself in. */
export function CatalogSearch({ onPick }: { onPick: (glass: CatalogGlass) => void }) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CatalogGlass | null>(null);
  const results = useMemo(() => searchCatalog(query, 6), [query]);

  return (
    <View style={[styles.box, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
      <Field
        label="Look it up"
        hint="Type the code from the label or a color, like 1101, SF523.2W or cobalt. Bullseye and Oceanside are built in."
        placeholder="Code or color"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setPicked(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {results.map((g) => (
        <Pressable
          key={`${g.maker}${g.code}`}
          onPress={() => {
            onPick(g);
            setPicked(g);
            setQuery('');
          }}
          accessibilityRole="button"
          accessibilityLabel={`${g.maker} ${g.code}, ${g.name}, COE ${g.coe}`}
          style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.swatch, { backgroundColor: g.hex ?? colorFamily(g.colorFamily)?.swatch ?? '#ccc', borderColor: c.border }]} />
          <View style={styles.text}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
              {g.name}
            </Text>
            <Text style={[styles.meta, { color: c.muted }]}>{`${g.maker} ${g.code} · ${typeLabel(g.glassType)}`}</Text>
          </View>
          <CoeBadge coe={g.coe} />
        </Pressable>
      ))}
      {query.trim().length >= 2 && results.length === 0 && (
        <Text style={[styles.meta, { color: c.muted }]}>Not in the built-in list. Fill it in below.</Text>
      )}
      {picked && (
        <Text style={[styles.done, { color: c.text }]} accessibilityLiveRegion="polite">
          {`Filled in from the ${picked.maker} catalog. Check it over, then add how much you have.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: space.md, gap: space.sm },
  row: { minHeight: tapTarget + 8, borderWidth: 1, borderRadius: 12, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 8, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: type.label, fontWeight: '700' },
  meta: { fontSize: type.small },
  done: { fontSize: type.label, fontWeight: '600' },
});
