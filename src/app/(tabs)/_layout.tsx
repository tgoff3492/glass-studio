import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countOpenShopping } from '@/db/shoppingRepo';
import { countLowSupplies } from '@/db/suppliesRepo';
import { onShoppingChanged } from '@/lib/shoppingCount';
import { type, useColors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Inventory', icon: 'layers-outline' },
  { name: 'shopping', title: 'Shopping', icon: 'cart-outline' },
  { name: 'projects', title: 'Projects', icon: 'images-outline' },
  { name: 'kiln', title: 'Kiln', icon: 'flame-outline' },
];

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toBuy = useToBuyCount();
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
    Promise.all([countLowSupplies(db), countOpenShopping(db)]).then(([low, open]) => {
      if (alive) setN(low + open);
    });
    return () => {
      alive = false;
    };
  }, [db, pathname, bump]);
  useEffect(() => onShoppingChanged(refresh), [refresh]);
  return n;
}
