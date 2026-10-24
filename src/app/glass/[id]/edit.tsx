import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GlassForm } from '@/components/glass/GlassForm';
import { getGlass, listGlassSizes, updateGlass } from '@/db/glassRepo';
import type { GlassItem } from '@/db/types';
import { inputFromItem } from '@/domain/glass';
import type { SheetSize } from '@/domain/sizes';
import { discardPhotos } from '@/lib/photoCleanup';
import { useColors } from '@/theme/theme';

export default function EditGlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{ item: GlassItem; sizes: SheetSize[] } | null>(null);

  useEffect(() => {
    Promise.all([getGlass(db, id), listGlassSizes(db, id)]).then(([item, sizes]) => {
      if (item) setLoaded({ item, sizes });
    });
  }, [db, id]);

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const { item, sizes } = loaded;
  return (
    <>
      <Stack.Screen options={{ title: `Edit ${item.color_name}` }} />
      <GlassForm
        initial={inputFromItem(item, sizes)}
        itemId={item.id}
        submitLabel="Save changes"
        onSubmit={async (fields, newSizes) => {
          await updateGlass(db, item.id, fields, newSizes);
          // Photos that were replaced or removed are no longer needed.
          discardPhotos(item, fields);
          router.back();
        }}
        onCancel={(current) => {
          // Photos taken during this edit weren't saved.
          discardPhotos(current, item);
          router.back();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
