import React from 'react';
import { ItemRow } from './ItemRow';
import type { Item } from '@/types';

/** The detailed list shares state, actions and selection with the compact row. */
export function ItemDetailRow(props: { item: Item; onOpen?: (id: string) => void; active?: boolean; inColumn?: boolean }) {
  return <ItemRow {...props} detailed />;
}
