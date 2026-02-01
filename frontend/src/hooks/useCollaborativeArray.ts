'use client';

import * as React from 'react';
import type { CollaborationManager } from '@/lib/collaboration';

// ============================================================================
// useCollaborativeArray Hook
// ============================================================================

interface UseCollaborativeArrayOptions {
  getManager: () => CollaborationManager | null;
  arrayName: string;
}

export function useCollaborativeArray<T>({
  getManager,
  arrayName,
}: UseCollaborativeArrayOptions): {
  items: T[];
  push: (item: T) => void;
  insert: (index: number, item: T) => void;
  deleteItem: (index: number, length?: number) => void;
  update: (index: number, item: T) => void;
} {
  const [items, setItems] = React.useState<T[]>([]);

  React.useEffect(() => {
    const manager = getManager();
    if (!manager) return;

    const yarray = manager.getSharedArray<T>(arrayName);

    // Get initial items
    setItems(yarray.toArray());

    // Subscribe to changes
    const observer = () => {
      setItems(yarray.toArray());
    };

    yarray.observe(observer);

    return () => {
      yarray.unobserve(observer);
    };
  }, [getManager, arrayName]);

  const push = React.useCallback(
    (item: T) => {
      const manager = getManager();
      if (!manager) return;
      const yarray = manager.getSharedArray<T>(arrayName);
      yarray.push([item]);
    },
    [getManager, arrayName]
  );

  const insert = React.useCallback(
    (index: number, item: T) => {
      const manager = getManager();
      if (!manager) return;
      const yarray = manager.getSharedArray<T>(arrayName);
      yarray.insert(index, [item]);
    },
    [getManager, arrayName]
  );

  const deleteItem = React.useCallback(
    (index: number, length: number = 1) => {
      const manager = getManager();
      if (!manager) return;
      const yarray = manager.getSharedArray<T>(arrayName);
      yarray.delete(index, length);
    },
    [getManager, arrayName]
  );

  const update = React.useCallback(
    (index: number, item: T) => {
      const manager = getManager();
      if (!manager) return;
      const yarray = manager.getSharedArray<T>(arrayName);
      manager.ydoc.transact(() => {
        yarray.delete(index, 1);
        yarray.insert(index, [item]);
      });
    },
    [getManager, arrayName]
  );

  return {
    items,
    push,
    insert,
    deleteItem,
    update,
  };
}

export default useCollaborativeArray;
