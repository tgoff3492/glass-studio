import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: type.small, fontWeight: '600' },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Ionicons name={t.icon} size={28} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
