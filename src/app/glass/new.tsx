import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { GlassForm } from '@/components/glass/GlassForm';
import { createGlass } from '@/db/glassRepo';
import type { GlassKind } from '@/db/types';
import { GLASS_KINDS, emptyGlassInput } from '@/domain/glass';
import { discardPhotos } from '@/lib/photoCleanup';

export default function NewGlassScreen() {
  const db = useSQLiteContext();
  const { kind, barcode } = useLocalSearchParams<{ kind?: string; barcode?: string }>();
  const startKind = GLASS_KINDS.some((k) => k.value === kind) ? (kind as GlassKind) : 'sheet';
  const [initial] = useState(() => emptyGlassInput(startKind, barcode ?? ''));

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
