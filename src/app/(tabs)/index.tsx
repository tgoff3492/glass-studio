import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';
import { type, useColors } from '@/theme/theme';

export default function GlassScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM glass_items')
      .then((row) => setCount(row?.n ?? 0))
      .catch(() => setCount(null));
  }, [db]);

  return (
    <ComingSoon
      title="Glass"
      phase="Coming in Phase 1"
      summary="Every sheet, jar of frit and bin of scrap in the studio, with COE on each one."
      features={[
        'Sheet glass by maker, color, product code and COE',
        'Frit, powder, stringers, noodles and confetti by weight',
        'A scrap bin for offcuts',
        'A photo of each sheet, plus how it looks once fired',
        'Search by color, maker, COE or type',
      ]}
    >
      {count !== null && (
        <Text style={[styles.status, { color: c.muted }]}>
          {count === 0 ? 'Storage is ready. No glass added yet.' : `${count} glass items saved.`}
        </Text>
      )}
    </ComingSoon>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: type.label },
});
