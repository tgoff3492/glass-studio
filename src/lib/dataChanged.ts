// Lets lists refresh when something changes elsewhere on screen — on an iPad the list
// and the open item are side by side, so a tap in one should show in the other.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dataChanged(): void {
  listeners.forEach((l) => l());
}
