'use client';

import * as React from 'react';
import type * as Y from 'yjs';
import type { CollaborationManager } from '@/lib/collaboration';

// ============================================================================
// useCollaborativeText Hook
// ============================================================================

interface UseCollaborativeTextOptions {
  getManager: () => CollaborationManager | null;
  textName: string;
}

interface UseCollaborativeTextReturn {
  text: string;
  getYText: () => Y.Text | null;
  insert: (index: number, content: string) => void;
  deleteText: (index: number, length: number) => void;
  setText: (content: string) => void;
}

export function useCollaborativeText({
  getManager,
  textName,
}: UseCollaborativeTextOptions): UseCollaborativeTextReturn {
  const [text, setText] = React.useState<string>('');
  const ytextRef = React.useRef<Y.Text | null>(null);

  React.useEffect(() => {
    const manager = getManager();
    if (!manager) {
      ytextRef.current = null;
      return;
    }

    const ytext = manager.getSharedText(textName);
    ytextRef.current = ytext;

    // Get initial text
    setText(ytext.toString());

    // Subscribe to changes
    const observer = () => {
      setText(ytext.toString());
    };

    ytext.observe(observer);

    return () => {
      ytext.unobserve(observer);
      ytextRef.current = null;
    };
  }, [getManager, textName]);

  const getYText = React.useCallback(() => {
    return ytextRef.current;
  }, []);

  const insert = React.useCallback(
    (index: number, content: string) => {
      ytextRef.current?.insert(index, content);
    },
    []
  );

  const deleteText = React.useCallback(
    (index: number, length: number) => {
      ytextRef.current?.delete(index, length);
    },
    []
  );

  const setTextContent = React.useCallback(
    (content: string) => {
      const manager = getManager();
      if (!ytextRef.current || !manager) return;

      manager.ydoc.transact(() => {
        ytextRef.current!.delete(0, ytextRef.current!.length);
        ytextRef.current!.insert(0, content);
      });
    },
    [getManager]
  );

  return {
    text,
    getYText,
    insert,
    deleteText,
    setText: setTextContent,
  };
}

export default useCollaborativeText;
