import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countLowGlass } from '@/db/glassRepo';
import { SETTING, countEverything, getSetting, setSetting } from '@/db/settingsRepo';
import { countOpenShopping } from '@/db/shoppingRepo';
import { snapshotDatabase } from '@/db/snapshot';
import { countLowSupplies } from '@/db/suppliesRepo';
import { onShoppingChanged } from '@/lib/shoppingCount';
import { type, useColors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Inventory', icon: 'layers-outline' },
  { name: 'shopping', title: 'Shopping', icon: 'cart-outline' },
  { name: 'projects', title: 'Projects', icon: 'images-outline' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline' },
];

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toBuy = useToBuyCount();
  useOnLaunch();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // Taller than the default so the larger labels aren't clipped.
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        tabBarItemStyle: { height: 58 },
        tabBarLabelStyle: { fontSize: type.small, fontWeight: '600', lineHeight: type.small * 1.3 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarBadge: t.name === 'shopping' && toBuy > 0 ? toBuy : undefined,
            tabBarBadgeStyle: { backgroundColor: c.danger, color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
            tabBarAccessibilityLabel: t.name === 'shopping' && toBuy > 0 ? `Shopping, ${toBuy} to buy` : t.title,
            tabBarIcon: ({ color }) => <Ionicons name={t.icon} size={24} color={color as string} />,
          }}
        />
      ))}
      {/* Kathryn's kiln has its own app, so the kiln log waits. The screen stays for a future link to it. */}
      <Tabs.Screen name="kiln" options={{ href: null }} />
    </Tabs>
  );
}

/** Things to buy: running-low supplies plus unchecked list items. Refreshes on every screen change. */
function useToBuyCount(): number {
  const db = useSQLiteContext();
  const pathname = usePathname();
  const [n, setN] = useState(0);
  const [bump, setBump] = useState(0);
  const refresh = useCallback(() => setBump((b) => b + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([countLowSupplies(db), countLowGlass(db), countOpenShopping(db)]).then(([low, lowGlass, open]) => {
      if (alive) setN(low + lowGlass + open);
    });
    return () => {
      alive = false;
    };
  }, [db, pathname, bump]);
  useEffect(() => onShoppingChanged(refresh), [refresh]);
  return n;
}

const WEEK = 7 * 86_400_000;

/** Once per launch: show the welcome the first time, and keep a weekly copy of the records. */
function useOnLaunch() {
  const db = useSQLiteContext();
  useEffect(() => {
    (async () => {
      const [seen, lastSnapshot, counts] = await Promise.all([
        getSetting(db, SETTING.welcomeSeen),
        getSetting(db, SETTING.lastSnapshotAt),
        countEverything(db),
      ]);
      if (!seen) router.push('/welcome');
      const due = !lastSnapshot || Date.now() - new Date(lastSnapshot).getTime() > WEEK;
      if (due && counts.glass + counts.supplies + counts.projects > 0 && (await snapshotDatabase(db, 'weekly'))) {
        await setSetting(db, SETTING.lastSnapshotAt, new Date().toISOString());
      }
    })().catch(() => {});
  }, [db]);
}
