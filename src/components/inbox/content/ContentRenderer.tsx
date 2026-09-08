import React from 'react';

import { getContentType, type ContentType } from '@/lib/contentType';
import type { Item } from '@/types';

import { SemanticContent } from './SemanticContent';
import { CarouselContent } from './CarouselContent';
import { GenericContent } from './GenericContent';
import { ReceiptContent } from './ReceiptContent';
import { ReelContent } from './ReelContent';
import { YouTubeContent } from './YouTubeContent';

/**
 * Switches between content-type-specific renderers. The detail screen calls
 * this from inside the body of the item — every renderer is responsible for
 * its own visual + textual presentation, including any primary media.
 *
 * Mirrors apps/web/components/inbox/content/ContentRenderer.tsx.
 */
export const ContentRenderer: React.FC<{ item: Item; contentType?: ContentType }> = ({
  item,
  contentType,
}) => {
  const type = contentType ?? getContentType(item);

  return <><SemanticContent item={item} /><OriginalContent item={item} type={type} /></>;
};

function OriginalContent({ item, type }: { item: Item; type: ContentType }) {
  switch (type) {
    case 'carousel':
      return <CarouselContent item={item} />;
    case 'youtube':
      return <YouTubeContent item={item} />;
    case 'reel':
      return <ReelContent item={item} />;
    case 'receipt':
      return <ReceiptContent item={item} />;
    default:
      return <GenericContent item={item} />;
  }
};
