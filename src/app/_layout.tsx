import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrate';
import { type, useColors } from '@/theme/theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <StatusBar style="auto" />
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
      </Stack>
    </SQLiteProvider>
  );
}
