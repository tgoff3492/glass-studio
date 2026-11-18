import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { GlassForm } from '@/components/glass/GlassForm';
import { createGlass, getGlass } from '@/db/glassRepo';
import type { GlassKind } from '@/db/types';
import { findByCode } from '@/domain/catalog';
import { GLASS_KINDS, copyGlassInput, emptyGlassInput, type GlassInput } from '@/domain/glass';
import { discardPhotos } from '@/lib/photoCleanup';
import { useColors } from '@/theme/theme';

/** A blank form, or one started from a scanned label the catalog knows. */
function startingInput(kind: GlassKind, barcode: string): GlassInput {
  const input = emptyGlassInput(kind, barcode);
  const match = barcode ? findByCode(barcode) : [];
  if (match.length !== 1) return input;
  const g = match[0];
  return { ...input, color_name: g.name, manufacturer: g.maker, product_code: g.code, coe: g.coe, glass_type: g.glassType, color_family: g.colorFamily };
}

export default function NewGlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { kind, barcode, copyFrom } = useLocalSearchParams<{ kind?: string; barcode?: string; copyFrom?: string }>();
  const startKind = GLASS_KINDS.some((k) => k.value === kind) ? (kind as GlassKind) : 'sheet';
  const [initial, setInitial] = useState<GlassInput | null>(() => (copyFrom ? null : startingInput(startKind, barcode ?? '')));

  // "Add another like this": same glass, none of the stock or photos.
  useEffect(() => {
    if (!copyFrom) return;
    getGlass(db, copyFrom).then((item) => setInitial(item ? copyGlassInput(item) : emptyGlassInput(startKind)));
  }, [db, copyFrom, startKind]);

  if (!initial) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <GlassForm
      initial={initial}
      submitLabel="Add to inventory"
      onSubmit={async (fields, sizes) => {
        const id = await createGlass(db, fields, sizes);
        router.replace({ pathname: '/glass/[id]', params: { id } });
      }}
      onCancel={(current) => {
        discardPhotos(current);
        router.back();
      }}
    />
  );
}
