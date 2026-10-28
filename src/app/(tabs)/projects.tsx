import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectThumb, StatusPill } from '@/components/projects/ProjectBits';
import { Button, Chip, Column } from '@/components/ui';
import { listProjects, type ProjectListItem } from '@/db/projectsRepo';
import type { ProjectKind } from '@/db/types';
import { kindLabel } from '@/domain/projects';
import { space, tapTarget, type, useColors } from '@/theme/theme';

type Show = 'active' | 'done' | 'all';

export default function ProjectsScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [show, setShow] = useState<Show>('active');
  const [kind, setKind] = useState<ProjectKind | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [rows, all] = await Promise.all([
      listProjects(db, { show, kind, search }),
      db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM projects'),
    ]);
    setItems(rows);
    setTotal(all?.n ?? 0);
  }, [db, show, kind, search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const newProject = () => router.push('/projects/new');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Column style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            Projects
          </Text>
          <Button label="+ New" onPress={newProject} style={styles.addButton} accessibilityHint="Start a new project" />
        </View>
      </Column>
      <FlatList
        data={items ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          total > 0 ? (
            <Column style={styles.filters}>
              <View style={[styles.search, { backgroundColor: c.input, borderColor: c.border }]}>
                <Ionicons name="search" size={22} color={c.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search projects"
                  placeholderTextColor={c.muted}
                  accessibilityLabel="Search projects"
                  style={[styles.searchInput, { color: c.text }]}
                  clearButtonMode="while-editing"
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="In progress" selected={show === 'active'} onPress={() => setShow('active')} />
                <Chip label="Done" selected={show === 'done'} onPress={() => setShow('done')} />
                <Chip label="All" selected={show === 'all'} onPress={() => setShow('all')} />
                <Chip label="Stained" selected={kind === 'stained'} onPress={() => setKind(kind === 'stained' ? null : 'stained')} />
                <Chip label="Fused" selected={kind === 'fused'} onPress={() => setKind(kind === 'fused' ? null : 'fused')} />
              </ScrollView>
            </Column>
          ) : undefined
        }
        ItemSeparatorComponent={() => (
          <Column>
            <View style={[styles.sep, { backgroundColor: c.border }]} />
          </Column>
        )}
        renderItem={({ item }) => <ProjectRow item={item} />}
        ListEmptyComponent={
          items === null ? undefined : total === 0 ? (
            <Column style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No projects yet</Text>
              <Text style={[styles.body, { color: c.muted }]}>
                Start one for each piece. Add the pattern, pull glass from inventory, and keep progress photos and time in one place.
              </Text>
              <Button label="Start your first project" onPress={newProject} />
            </Column>
          ) : (
            <Column style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {show === 'done' && !search && !kind ? 'Nothing finished yet' : show === 'active' && !search && !kind ? 'Nothing in progress' : 'Nothing matches'}
              </Text>
              <Button label="Show all projects" variant="secondary" onPress={() => { setShow('all'); setKind(null); setSearch(''); }} />
            </Column>
          )
        }
      />
    </SafeAreaView>
  );
}

function ProjectRow({ item }: { item: ProjectListItem }) {
  const c = useColors();
  const meta = [kindLabel(item.kind), item.glass_count > 0 ? `${item.glass_count} glass` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Column>
      <Pressable
        onPress={() => router.push({ pathname: '/projects/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <ProjectThumb uri={item.cover_uri} kind={item.kind} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
            {meta}
          </Text>
          <View style={styles.pillRow}>
            <StatusPill kind={item.kind} status={item.status} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={c.muted} />
      </Pressable>
    </Column>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: space.md, paddingTop: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontSize: type.title, fontWeight: '700' },
  addButton: { minHeight: 48, paddingHorizontal: space.md },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, flexGrow: 1 },
  filters: { gap: space.sm, paddingTop: space.md, paddingBottom: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 12, paddingHorizontal: space.md, minHeight: tapTarget },
  searchInput: { flex: 1, fontSize: type.body, minHeight: tapTarget },
  chips: { gap: space.sm, paddingRight: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: tapTarget },
  rowText: { flex: 1, gap: 4, minWidth: 0 },
  rowTitle: { fontSize: type.body, fontWeight: '700' },
  rowSub: { fontSize: type.label },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { gap: space.md, paddingTop: space.xl },
  emptyTitle: { fontSize: type.heading, fontWeight: '700' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
});
