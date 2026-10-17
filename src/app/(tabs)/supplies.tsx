import { ComingSoon } from '@/components/ComingSoon';

export default function SuppliesScreen() {
  return (
    <ComingSoon
      title="Supplies"
      phase="Coming in Phase 2"
      summary="Everything that isn't glass, and a heads-up before anything runs out."
      features={[
        'Copper foil, solder, came, flux and patina',
        'Kiln wash, fiber paper, shelf paper and molds',
        'Low-stock alerts at a minimum you set',
        'A shopping list that fills itself in',
      ]}
    />
  );
}
