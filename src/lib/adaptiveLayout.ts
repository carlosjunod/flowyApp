/** Layout follows the app window, never a device model or the physical screen. */
export function adaptiveLayout(width: number, height: number, fontScale = 1) {
  const minPaneWidth = 400 * Math.max(1, fontScale);
  const split = width > height && width >= minPaneWidth * 2 + 1;
  const inboxWidth = split ? Math.floor((width - 1) / 2) : width;
  return { split, inboxWidth, chatWidth: split ? width - inboxWidth - 1 : width };
}

export function inboxColumns(width: number, fontScale = 1): number {
  // Compact rows retain room for a thumbnail, metadata and selection.
  return Math.max(1, Math.min(3, Math.floor((width - 32 + 12) / (340 * Math.max(1, fontScale) + 12))));
}

/** Two phone columns; larger windows add columns at a readable card width. */
export function inboxCardColumns(width: number, fontScale = 1): number {
  if (width < 640) return 2;
  const minCardWidth = 240 * Math.max(1, fontScale);
  return Math.max(2, Math.floor((width - 32 + 12) / (minCardWidth + 12)));
}

export function tabIsVisible(name: string, active: string, split: boolean): boolean {
  return name === active || (split && active === 'chat' && name === 'inbox');
}
