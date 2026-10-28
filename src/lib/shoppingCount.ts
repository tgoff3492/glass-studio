// Lets the tab bar badge refresh as soon as the shopping list changes,
// without each screen needing to know about the tab bar.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onShoppingChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function shoppingChanged(): void {
  listeners.forEach((l) => l());
}
