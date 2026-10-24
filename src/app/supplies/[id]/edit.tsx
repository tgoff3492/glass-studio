import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SupplyForm } from '@/components/supplies/SupplyForm';
import { getSupply, updateSupply } from '@/db/suppliesRepo';
import type { Supply } from '@/db/types';
import { supplyInputFromItem } from '@/domain/supplies';
import { deletePhoto } from '@/lib/photos';
import { useColors } from '@/theme/theme';

export default function EditSupplyScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Supply | null>(null);

  useEffect(() => {
    getSupply(db, id).then(setItem);
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
      <Stack.Screen options={{ title: `Edit ${item.name}` }} />
      <SupplyForm
        initial={supplyInputFromItem(item)}
        submitLabel="Save changes"
        onSubmit={async (fields) => {
          await updateSupply(db, item.id, fields);
          if (item.photo_uri && item.photo_uri !== fields.photo_uri) deletePhoto(item.photo_uri);
          router.back();
        }}
        onCancel={(current) => {
          if (current.photo_uri && current.photo_uri !== item.photo_uri) deletePhoto(current.photo_uri);
          router.back();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
