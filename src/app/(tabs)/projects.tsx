import { ComingSoon } from '@/components/ComingSoon';

export default function ProjectsScreen() {
  return (
    <ComingSoon
      title="Projects"
      phase="Coming in Phase 3"
      summary="A record of each piece, from pattern to finished work."
      features={[
        'Pattern and progress photos',
        'Glass pulled from inventory, which updates on its own',
        'A warning before mixing COE 90 and 96 in a fused piece',
        'Status from idea through cutting, firing and done',
      ]}
    />
  );
}
