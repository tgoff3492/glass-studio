import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { space, type, useColors } from '@/theme/theme';

// iPad: the list on the left and the open item on the right, instead of a new screen for
// every tap. The detail screens don't need to know which way they're shown; they use the
// helpers here for their id, their title bar, and leaving.

const WIDE = 768;

/** True on an iPad (or a wide window), where list and details sit side by side. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE;
}

type Pane = { embedded: boolean; id?: string; onGone?: () => void };
const PaneContext = createContext<Pane>({ embedded: false });

type Opener = (kind: 'glass' | 'supply' | 'project', id: string) => void;
const pushScreen: Opener = (kind, id) => {
  if (kind === 'glass') router.push({ pathname: '/glass/[id]', params: { id } });
  else if (kind === 'supply') router.push({ pathname: '/supplies/[id]', params: { id } });
  else router.push({ pathname: '/projects/[id]', params: { id } });
};
const OpenContext = createContext<Opener>(pushScreen);

/** How lists open an item: a new screen on a phone, the right-hand pane on an iPad. */
export const useOpenItem = () => useContext(OpenContext);

const SelectedContext = createContext<string | null>(null);

/** True for the list row whose item is open beside the list, so it can be highlighted. */
export const useIsOpen = (kind: 'glass' | 'supply' | 'project', id: string) => useContext(SelectedContext) === `${kind}:${id}`;

/** The id a detail screen shows: from the pane on an iPad, from the address otherwise. */
export function useDetailId(): string {
  const pane = useContext(PaneContext);
  const params = useLocalSearchParams<{ id: string }>();
  return pane.id ?? params.id;
}

/** What a detail screen does when its item is deleted or missing. */
export function useLeave(): () => void {
  const pane = useContext(PaneContext);
  return pane.embedded ? (pane.onGone ?? (() => {})) : () => router.back();
}

/** The title bar: the navigation header on a phone, a bar at the top of the pane on an iPad. */
export function ScreenOptions({ options }: { options: { title?: string; headerRight?: () => ReactNode } }) {
  const pane = useContext(PaneContext);
  const c = useColors();
  if (!pane.embedded) return <Stack.Screen options={options} />;
  return (
    <View style={[styles.bar, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={[styles.barTitle, { color: c.text }]} numberOfLines={1} accessibilityRole="header">
        {options.title}
      </Text>
      {options.headerRight?.()}
    </View>
  );
}

export type Selected = { kind: 'glass' | 'supply' | 'project'; id: string } | null;

/**
 * Shows `list` alone on a phone. On an iPad, shows `list` beside whichever item was picked,
 * drawn by `renderDetail`.
 */
export function SplitView({
  list,
  renderDetail,
  emptyText,
}: {
  list: ReactNode;
  renderDetail: (selected: NonNullable<Selected>) => ReactNode;
  emptyText: string;
}) {
  const wide = useIsWide();
  const c = useColors();
  const [selected, setSelected] = useState<Selected>(null);
  if (!wide) return <>{list}</>;

  return (
    <OpenContext.Provider value={(kind, id) => setSelected({ kind, id })}>
      <SelectedContext.Provider value={selected ? `${selected.kind}:${selected.id}` : null}>
        <View style={styles.split}>
          <View style={[styles.listPane, { borderColor: c.border }]}>{list}</View>
          <View style={styles.detailPane}>
            {selected ? (
              <PaneContext.Provider
                key={`${selected.kind}:${selected.id}`}
                value={{ embedded: true, id: selected.id, onGone: () => setSelected(null) }}
              >
                {renderDetail(selected)}
              </PaneContext.Provider>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="color-palette-outline" size={48} color={c.muted} />
                <Text style={[styles.emptyText, { color: c.muted }]}>{emptyText}</Text>
              </View>
            )}
          </View>
        </View>
      </SelectedContext.Provider>
    </OpenContext.Provider>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  listPane: { width: 400, maxWidth: '45%', borderRightWidth: 1 },
  detailPane: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  emptyText: { fontSize: type.body, textAlign: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderBottomWidth: 1 },
  barTitle: { flex: 1, fontSize: type.heading, fontWeight: '700' },
});
