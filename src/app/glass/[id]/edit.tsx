import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GlassForm } from '@/components/glass/GlassForm';
import { getGlass, updateGlass } from '@/db/glassRepo';
import type { GlassItem } from '@/db/types';
import { inputFromItem } from '@/domain/glass';
import { discardPhotos } from '@/lib/photoCleanup';
import { useColors } from '@/theme/theme';

export default function EditGlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<GlassItem | null>(null);

  useEffect(() => {
    getGlass(db, id).then(setItem);
  }, [db, id]);

  if (!item) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Edit ${item.color_name}` }} />
      <GlassForm
        initial={inputFromItem(item)}
        itemId={item.id}
        submitLabel="Save changes"
        onSubmit={async (fields) => {
          await updateGlass(db, item.id, fields);
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
