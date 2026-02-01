'use client';

import * as React from 'react';
import type { CollaborationManager } from '@/lib/collaboration';

// ============================================================================
// useCollaborativeValue Hook
// ============================================================================

interface UseCollaborativeValueOptions<T> {
  getManager: () => CollaborationManager | null;
  mapName: string;
  key: string;
  defaultValue: T;
}

export function useCollaborativeValue<T>({
  getManager,
  mapName,
  key,
  defaultValue,
}: UseCollaborativeValueOptions<T>): [T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    const manager = getManager();
    if (!manager) return;

    const ymap = manager.getSharedMap<T>(mapName);

    // Get initial value
    const initialValue = ymap.get(key);
    if (initialValue !== undefined) {
      setValue(initialValue);
    }

    // Subscribe to changes
    const observer = () => {
      const newValue = ymap.get(key);
      if (newValue !== undefined) {
        setValue(newValue);
      } else {
        setValue(defaultValue);
      }
    };

    ymap.observe(observer);

    return () => {
      ymap.unobserve(observer);
    };
  }, [getManager, mapName, key, defaultValue]);

  const setCollaborativeValue = React.useCallback(
    (newValue: T) => {
      const manager = getManager();
      if (!manager) return;

      const ymap = manager.getSharedMap<T>(mapName);
      ymap.set(key, newValue);
    },
    [getManager, mapName, key]
  );

  return [value, setCollaborativeValue];
}

export default useCollaborativeValue;
