import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ProjectForm } from '@/components/projects/ProjectForm';
import { createProject } from '@/db/projectsRepo';

export default function NewProjectScreen() {
  const db = useSQLiteContext();
  return (
    <ProjectForm
      initial={{ name: '', kind: 'stained', notes: '' }}
      submitLabel="Start project"
      onSubmit={async (fields) => {
        const id = await createProject(db, fields);
        router.replace({ pathname: '/projects/[id]', params: { id } });
      }}
      onCancel={() => router.back()}
    />
  );
}
