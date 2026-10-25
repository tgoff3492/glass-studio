import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ProjectForm } from '@/components/projects/ProjectForm';
import { getProject, updateProject } from '@/db/projectsRepo';
import type { Project } from '@/db/types';
import { useColors } from '@/theme/theme';

export default function EditProjectScreen() {
  const db = useSQLiteContext();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    getProject(db, id).then(setProject);
  }, [db, id]);

  if (!project) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  return (
    <ProjectForm
      initial={{ name: project.name, kind: project.kind, notes: project.notes ?? '' }}
      submitLabel="Save changes"
      onSubmit={async (fields) => {
        await updateProject(db, project.id, fields);
        router.back();
      }}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
