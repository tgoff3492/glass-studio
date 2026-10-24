import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { SupplyForm } from '@/components/supplies/SupplyForm';
import { createSupply } from '@/db/suppliesRepo';
import { emptySupplyInput } from '@/domain/supplies';
import { deletePhoto } from '@/lib/photos';

export default function NewSupplyScreen() {
  const db = useSQLiteContext();
  const [initial] = useState(() => emptySupplyInput('foil'));
  return (
    <SupplyForm
      initial={initial}
      submitLabel="Add supply"
      onSubmit={async (fields) => {
        const id = await createSupply(db, fields);
        router.replace({ pathname: '/supplies/[id]', params: { id } });
      }}
      onCancel={(current) => {
        if (current.photo_uri) deletePhoto(current.photo_uri);
        router.back();
      }}
    />
  );
}
