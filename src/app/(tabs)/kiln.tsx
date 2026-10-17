import { ComingSoon } from '@/components/ComingSoon';

export default function KilnScreen() {
  return (
    <ComingSoon
      title="Kiln"
      phase="Coming in Phase 4"
      summary="Remember what worked so a good firing can be repeated."
      features={[
        'Schedules for full fuse, tack fuse, slump, drape and fire polish',
        'Each step as rate (°F/hr), target temperature and hold',
        'A log of every firing with before and after photos',
        'Copy a past firing to start a new one',
      ]}
    />
  );
}
