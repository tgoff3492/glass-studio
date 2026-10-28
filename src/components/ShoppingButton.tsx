import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { addShoppingItem, openItemFor } from '@/db/shoppingRepo';
import type { ShoppingSource } from '@/db/types';
import { shoppingChanged } from '@/lib/shoppingCount';
import { space, type, useColors } from '@/theme/theme';

type Props = { sourceType: ShoppingSource; sourceId: string; label: string };

/** "Add to shopping list", or a note that it's already there. */
export function ShoppingButton({ sourceType, sourceId, label }: Props) {
  const db = useSQLiteContext();
  const c = useColors();
  const [onList, setOnList] = useState(false);

  useFocusEffect(
    useCallback(() => {
      openItemFor(db, sourceType, sourceId).then((item) => setOnList(Boolean(item)));
    }, [db, sourceType, sourceId]),
  );

  if (onList) {
    return (
      <View style={[styles.note, { borderColor: c.border, backgroundColor: c.accentSoft }]}>
        <Text style={[styles.noteText, { color: c.text }]}>On the shopping list</Text>
      </View>
    );
  }
  return (
    <Button
      label="Add to shopping list"
      variant="secondary"
      onPress={async () => {
        await addShoppingItem(db, { label, source_type: sourceType, source_id: sourceId });
        setOnList(true);
        shoppingChanged();
      }}
    />
  );
}

const styles = StyleSheet.create({
  note: { minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  noteText: { fontSize: type.body, fontWeight: '700' },
});
