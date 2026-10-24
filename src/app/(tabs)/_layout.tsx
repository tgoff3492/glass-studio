import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type, useColors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Glass', icon: 'layers-outline' },
  { name: 'supplies', title: 'Supplies', icon: 'construct-outline' },
  { name: 'projects', title: 'Projects', icon: 'images-outline' },
  { name: 'kiln', title: 'Kiln', icon: 'flame-outline' },
];

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
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
            tabBarIcon: ({ color }) => <Ionicons name={t.icon} size={24} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
