import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyUndo, captureUndo, type UndoScope, type UndoSnapshot } from '@/db/undoRepo';
import { dataChanged } from '@/lib/dataChanged';
import { logError } from '@/lib/errorLog';
import { space, type, useColors } from '@/theme/theme';

// A small bar at the bottom after a quick change — "Cobalt: 2 sheets · Undo" — so a
// mis-tap with fluxy fingers is one tap to fix. Taps on the same thing in a row share one
// undo that goes back to before the first tap.

const SHOW_MS = 6000;

type Offer = { key: string; message: string; snapshot: UndoSnapshot; after: () => void };

type UndoApi = {
  /**
   * Copies what `scopes` covers, runs `change`, then offers to undo it. `after` reloads the
   * screen once an undo has put things back.
   */
  run: (opts: { key: string; scopes: UndoScope[]; change: () => Promise<string | null>; after: () => void }) => Promise<void>;
};

const UndoContext = createContext<UndoApi>({ run: async ({ change }) => void (await change()) });

export const useUndo = () => useContext(UndoContext);

export function UndoProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<Offer | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      current.current = null;
      setOffer(null);
    });
  }, [opacity]);

  const show = useCallback(
    (next: Offer) => {
      current.current = next;
      setOffer(next);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, SHOW_MS);
      AccessibilityInfo.announceForAccessibility?.(`${next.message}. Undo is available.`);
    },
    [hide, opacity],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const api = useMemo<UndoApi>(
    () => ({
      run: async ({ key, scopes, change, after }) => {
        const same = current.current?.key === key ? current.current : null;
        const snapshot = same ? same.snapshot : await captureUndo(db, scopes);
        const message = await change();
        dataChanged();
        if (message === null) return;
        show({ key, message, snapshot, after });
      },
    }),
    [db, show],
  );

  const undo = async () => {
    const o = current.current;
    if (!o) return;
    if (timer.current) clearTimeout(timer.current);
    try {
      await applyUndo(db, o.snapshot);
      o.after();
      dataChanged();
    } catch (err) {
      logError(err, 'undo');
    }
    hide();
  };

  return (
    <UndoContext.Provider value={api}>
      {children}
      {offer && (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72, opacity }]}>
          <View style={[styles.bar, { backgroundColor: c.text }]}>
            <Text style={[styles.message, { color: c.background }]} numberOfLines={2}>
              {offer.message}
            </Text>
            <Pressable
              onPress={undo}
              accessibilityRole="button"
              accessibilityLabel={`Undo: ${offer.message}`}
              hitSlop={8}
              style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: c.accentSoft }]}>Undo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </UndoContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.md },
  bar: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    paddingLeft: space.md,
    paddingRight: space.xs,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: { flex: 1, fontSize: type.label, fontWeight: '600', paddingVertical: space.sm },
  button: { minHeight: 48, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  buttonText: { fontSize: type.body, fontWeight: '800' },
});
