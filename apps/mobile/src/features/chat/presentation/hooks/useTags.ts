import { useEffect, useState } from 'react';

import { collections } from '../../../../foundation/storage';
import type { TagModel } from '../../../../foundation/storage/models/TagModel';

export function useTags() {
  const [tags, setTags] = useState<TagModel[]>([]);

  useEffect(() => {
    const sub = collections.tags
      .query()
      .observe()
      .subscribe(setTags);
    return () => sub.unsubscribe();
  }, []);

  return { tags };
}
