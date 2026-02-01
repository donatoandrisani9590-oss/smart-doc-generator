'use client';

import * as React from 'react';

// ============================================================================
// useCursorTracker Hook
// ============================================================================

interface UseCursorTrackerOptions {
  containerRef: React.RefObject<HTMLElement>;
  onCursorMove: (position: { x: number; y: number } | null) => void;
  throttleMs?: number;
}

export function useCursorTracker({
  containerRef,
  onCursorMove,
  throttleMs = 50,
}: UseCursorTrackerOptions) {
  const lastUpdateRef = React.useRef<number>(0);
  const isInsideRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;
      lastUpdateRef.current = now;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Check if cursor is inside container
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        isInsideRef.current = true;
        onCursorMove({ x, y });
      } else if (isInsideRef.current) {
        isInsideRef.current = false;
        onCursorMove(null);
      }
    };

    const handleMouseLeave = () => {
      if (isInsideRef.current) {
        isInsideRef.current = false;
        onCursorMove(null);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, onCursorMove, throttleMs]);
}

export default useCursorTracker;
