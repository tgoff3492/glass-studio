import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoeBadge } from '@/components/glass/CoeBadge';
import { GlassThumb } from '@/components/glass/GlassThumb';
import { PhotoSlot } from '@/components/glass/PhotoSlot';
import { CoeBanner, StatusPill } from '@/components/projects/ProjectBits';
import { SupplyThumb } from '@/components/supplies/SupplyBits';
import { Button, Chip, ChipRow, Column } from '@/components/ui';
import {
  addProjectPhoto,
  deleteProject,
  deleteProjectPhoto,
  describeUse,
  getProject,
  listProjectGlass,
  listProjectPhotos,
  listProjectSupplies,
  returnGlass,
  returnSupply,
  setPatternPhoto,
  setProjectStatus,
  type ProjectGlassLine,
  type ProjectSupplyLine,
} from '@/db/projectsRepo';
import type { Photo, Project } from '@/db/types';
import { formatQuantity } from '@/domain/glass';
import { kindLabel, projectCoeWarning, statusSteps } from '@/domain/projects';
import { supplyTitle } from '@/domain/supplies';
import { addPhoto, deletePhoto, photoProblem, type PhotoSource } from '@/lib/photos';
import { space, tapTarget, type, useColors } from '@/theme/theme';

type Loaded = { project: Project; glass: ProjectGlassLine[]; supplies: ProjectSupplyLine[]; photos: Photo[] };

export default function ProjectScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const project = await getProject(db, id);
    if (!project) {
      setData(null);
      return;
    }
    const [glass, supplies, photos] = await Promise.all([listProjectGlass(db, id), listProjectSupplies(db, id), listProjectPhotos(db, id)]);
    setData({ project, glass, supplies, photos });
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (data === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={[styles.body, { color: c.muted }]}>{"This project isn't here anymore."}</Text>
        <Button label="Back to projects" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const { project, glass, supplies, photos } = data;
  const warning = projectCoeWarning(project.kind, glass);
  const after = (fn: () => Promise<unknown>) => async () => {
    await fn();
    await load();
  };

  const addProgress = async (source: PhotoSource) => {
    setPhotoError(null);
    const r = await addPhoto(source);
    if (r.status === 'saved') {
      await addProjectPhoto(db, project.id, r.uri);
      await load();
    } else setPhotoError(photoProblem(r));
  };

  const remove = async (returnMaterials: boolean) => {
    const files = await deleteProject(db, project.id, returnMaterials);
    files.forEach(deletePhoto);
    router.back();
  };

  const edit = () => router.push({ pathname: '/projects/[id]/edit', params: { id: project.id } });

  return (
    <>
      <Stack.Screen
        options={{
          title: project.name,
          headerRight: () => (
            <Pressable onPress={edit} accessibilityRole="button" hitSlop={12} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: c.accent }]}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingBottom: space.xl + insets.bottom }]}>
        <Column style={styles.stack}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: c.text }]}>{project.name}</Text>
            <View style={styles.meta}>
              <Text style={[styles.tag, { color: c.muted }]}>{kindLabel(project.kind)} glass</Text>
              <StatusPill kind={project.kind} status={project.status} />
            </View>
            {(project.started_on || project.finished_on) && (
              <Text style={[styles.small, { color: c.muted }]}>
                {[project.started_on && `Started ${fmtDate(project.started_on)}`, project.finished_on && `Finished ${fmtDate(project.finished_on)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </View>

          <Section title="Where it's at">
            <ChipRow>
              {statusSteps(project.kind).map((s) => (
                <Chip key={s.value} label={s.label} selected={project.status === s.value} onPress={after(() => setProjectStatus(db, project.id, s.value))} />
              ))}
            </ChipRow>
          </Section>

          <CoeBanner warning={warning} />

          <Section title="Glass used" action={{ label: '+ Use glass', onPress: () => router.push({ pathname: '/projects/[id]/add-glass', params: { id: project.id } }) }}>
            {glass.length === 0 ? (
              <Text style={[styles.empty, { color: c.muted }]}>
                {"Nothing yet. Tap “Use glass” to pull it from inventory; it comes off what you have."}
              </Text>
            ) : (
              glass.map((g) => (
                <View key={g.id} style={styles.line}>
                  <GlassThumb uri={g.photo_uri} family={g.color_family} size={44} />
                  <View style={styles.lineText}>
                    <Text style={[styles.lineTitle, { color: c.text }]} numberOfLines={2}>
                      {g.color_name}
                    </Text>
                    <View style={styles.lineMeta}>
                      {project.kind === 'fused' && <CoeBadge coe={g.coe} />}
                      <Text style={[styles.lineAmount, { color: c.text }]}>{describeUse(g)}</Text>
                    </View>
                  </View>
                  <SmallButton label="Put back" a11y={`Put ${g.color_name} back in inventory`} onPress={after(() => returnGlass(db, g.id))} />
                </View>
              ))
            )}
          </Section>

          <Section title="Supplies used" action={{ label: '+ Use supply', onPress: () => router.push({ pathname: '/projects/[id]/add-supply', params: { id: project.id } }) }}>
            {supplies.length === 0 ? (
              <Text style={[styles.empty, { color: c.muted }]}>Optional. Track foil, solder and the rest to see what a piece really costs later.</Text>
            ) : (
              supplies.map((s) => (
                <View key={s.id} style={styles.line}>
                  <SupplyThumb uri={s.photo_uri} category={s.category} size={44} />
                  <View style={styles.lineText}>
                    <Text style={[styles.lineTitle, { color: c.text }]} numberOfLines={2}>
                      {supplyTitle(s)}
                    </Text>
                    <Text style={[styles.lineAmount, { color: c.text }]}>{formatQuantity(s.quantity, s.unit)}</Text>
                  </View>
                  <SmallButton label="Put back" a11y={`Put ${s.name} back in inventory`} onPress={after(() => returnSupply(db, s.id))} />
                </View>
              ))
            )}
          </Section>

          <Section title="Photos">
            <PhotoSlot
              label="Pattern"
              uri={project.pattern_photo_uri}
              onChange={async (uri) => {
                if (project.pattern_photo_uri && project.pattern_photo_uri !== uri) deletePhoto(project.pattern_photo_uri);
                await setPatternPhoto(db, project.id, uri);
                await load();
              }}
            />
            <Text style={[styles.subhead, { color: c.text }]}>Progress</Text>
            {photos.length > 0 && (
              <View style={styles.grid}>
                {photos.map((p) => (
                  <Pressable key={p.id} onPress={() => setViewing(p)} accessibilityRole="imagebutton" accessibilityLabel={`Progress photo from ${fmtDate(p.created_at)}`} style={styles.gridItem}>
                    <Image source={{ uri: p.uri }} style={[styles.gridImage, { borderColor: c.border }]} contentFit="cover" />
                    <Text style={[styles.small, { color: c.muted }]}>{fmtDate(p.created_at)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {photoError && <Text style={[styles.small, { color: c.danger }]}>{photoError}</Text>}
            <View style={styles.photoButtons}>
              <Button label="Take photo" variant="secondary" onPress={() => addProgress('camera')} style={styles.flexButton} />
              <Button label="Choose photo" variant="secondary" onPress={() => addProgress('library')} style={styles.flexButton} />
            </View>
          </Section>

          {project.notes && (
            <Section title="Notes">
              <Text style={[styles.body, { color: c.text }]}>{project.notes}</Text>
            </Section>
          )}

          {confirmDelete ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.danger }]}>
              <Text style={[styles.body, { color: c.text }]}>{`Delete “${project.name}”? What about the glass and supplies it used?`}</Text>
              <Button label="Delete and put them back" variant="danger" onPress={() => remove(true)} />
              <Button label="Delete, they were used" variant="danger" onPress={() => remove(false)} />
              <Button label="Keep the project" variant="secondary" onPress={() => setConfirmDelete(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink}>
              <Text style={[styles.deleteText, { color: c.danger }]}>Delete this project</Text>
            </Pressable>
          )}
        </Column>
      </ScrollView>

      <Modal visible={viewing !== null} animationType="fade" onRequestClose={() => setViewing(null)} transparent={false}>
        <SafeAreaView style={[styles.viewer, { backgroundColor: '#000' }]}>
          {viewing && (
            <>
              <Image source={{ uri: viewing.uri }} style={styles.viewerImage} contentFit="contain" />
              <Text style={styles.viewerDate}>{fmtDate(viewing.created_at)}</Text>
              <View style={styles.viewerButtons}>
                <Button label="Close" variant="secondary" onPress={() => setViewing(null)} style={styles.flexButton} />
                <Button
                  label="Delete photo"
                  variant="danger"
                  style={styles.flexButton}
                  onPress={async () => {
                    const uri = await deleteProjectPhoto(db, viewing.id);
                    if (uri) deletePhoto(uri);
                    setViewing(null);
                    await load();
                  }}
                />
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString();

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.muted }]} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
        {action && (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={styles.sectionAction}>
            <Text style={[styles.sectionActionText, { color: c.accent }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function SmallButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.small_btn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="return-up-back" size={18} color={c.accent} />
      <Text style={[styles.smallBtnText, { color: c.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  content: { padding: space.md },
  stack: { gap: space.lg },
  titleBlock: { gap: space.xs },
  title: { fontSize: type.title, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  tag: { fontSize: type.label, fontWeight: '600' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  small: { fontSize: type.small },
  card: { borderWidth: 1, borderRadius: 12, padding: space.md, gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  sectionTitle: { fontSize: type.small, fontWeight: '800', letterSpacing: 0.8 },
  sectionAction: { minHeight: 44, justifyContent: 'center' },
  sectionActionText: { fontSize: type.label, fontWeight: '800' },
  empty: { fontSize: type.label, lineHeight: type.label * 1.4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: tapTarget },
  lineText: { flex: 1, gap: 3, minWidth: 0 },
  lineTitle: { fontSize: type.body, fontWeight: '700' },
  lineMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lineAmount: { fontSize: type.label, fontWeight: '600', fontVariant: ['tabular-nums'] },
  small_btn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: space.sm, borderRadius: 10, borderWidth: 1 },
  smallBtnText: { fontSize: type.small, fontWeight: '800' },
  subhead: { fontSize: type.label, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridItem: { width: '31%', minWidth: 96, gap: 2 },
  gridImage: { width: '100%', aspectRatio: 1, borderRadius: 10, borderWidth: 1 },
  photoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flexButton: { flexGrow: 1, paddingHorizontal: space.md },
  headerButton: { paddingHorizontal: space.sm, minHeight: 44, justifyContent: 'center' },
  headerButtonText: { fontSize: type.body, fontWeight: '700' },
  deleteLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
  deleteText: { fontSize: type.label, fontWeight: '700' },
  viewer: { flex: 1, padding: space.md, gap: space.md },
  viewerImage: { flex: 1, width: '100%' },
  viewerDate: { color: '#FFFFFF', fontSize: type.label, textAlign: 'center' },
  viewerButtons: { flexDirection: 'row', gap: space.sm },
});
