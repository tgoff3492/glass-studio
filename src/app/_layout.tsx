import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { ErrorScreen } from '@/components/ErrorScreen';
import { UndoProvider } from '@/components/Undo';
import { databaseName, migrateDbIfNeeded } from '@/db/migrate';

import { type, useColors } from '@/theme/theme';

// Read once at startup: on the web preview it can depend on the address, which changes as she moves around.
const DB_NAME = databaseName();

export default function RootLayout() {
  const c = useColors();
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrateDbIfNeeded}>
      <StatusBar style="auto" />
      <UndoProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text, fontSize: type.body, fontWeight: '700' },
          contentStyle: { backgroundColor: c.background },
          headerBackTitle: 'Back',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Glass' }} />
        <Stack.Screen name="glass/new" options={{ title: 'Add glass', presentation: 'modal' }} />
        <Stack.Screen name="glass/scan" options={{ title: 'Scan glass', presentation: 'modal' }} />
        <Stack.Screen name="glass/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="glass/[id]/edit" options={{ title: 'Edit', presentation: 'modal' }} />
        <Stack.Screen name="supplies/new" options={{ title: 'Add supply', presentation: 'modal' }} />
        <Stack.Screen name="supplies/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="supplies/[id]/edit" options={{ title: 'Edit', presentation: 'modal' }} />
        <Stack.Screen name="projects/new" options={{ title: 'New project', presentation: 'modal' }} />
        <Stack.Screen name="projects/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="projects/[id]/edit" options={{ title: 'Edit project', presentation: 'modal' }} />
        <Stack.Screen name="projects/[id]/add-glass" options={{ title: 'Use glass', presentation: 'modal' }} />
        <Stack.Screen name="projects/[id]/add-supply" options={{ title: 'Use a supply', presentation: 'modal' }} />
        <Stack.Screen name="projects/[id]/again" options={{ title: 'Make this again', presentation: 'modal' }} />
        <Stack.Screen name="feedback" options={{ title: 'Send Taylor a note', presentation: 'modal' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      </UndoProvider>
    </SQLiteProvider>
  );
}

/** Any screen that crashes shows this instead of a blank app. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}
