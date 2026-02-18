'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CollaborationUser } from '@/lib/collaboration';

// ============================================================================
// Types
// ============================================================================

interface CursorPresenceProps {
  users: CollaborationUser[];
  currentUserId: string;
  containerRef: React.RefObject<HTMLElement>;
  className?: string;
}

interface CursorProps {
  user: CollaborationUser;
  containerRect: DOMRect | null;
}

// ============================================================================
// Cursor Component
// ============================================================================

function Cursor({ user, containerRect }: CursorProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const fadeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate if cursor is stale (inactive for more than 5 seconds)
  React.useEffect(() => {
    if (user.lastActive) {
      const timeSinceActive = Date.now() - user.lastActive;
      const isStale = timeSinceActive > 5000;

      if (isStale) {
        setIsVisible(false);
      } else {
        setIsVisible(true);

        // Set timeout to fade out
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
        }

        fadeTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 5000 - timeSinceActive);
      }
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [user.lastActive]);

  // Reset visibility when cursor moves
  React.useEffect(() => {
    if (user.cursor) {
      setIsVisible(true);

      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }

      fadeTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to cursor position changes, not entire user object
  }, [user.cursor?.x, user.cursor?.y]);

  if (!user.cursor || !containerRect) {
    return null;
  }

  const { x, y } = user.cursor;

  // Check if cursor is within container bounds
  if (x < 0 || y < 0 || x > containerRect.width || y > containerRect.height) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-50 transition-all duration-75 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
      >
        <path
          d="M5.65376 12.4563L5.42773 12.7813L5.65376 12.4563ZM5.45376 4.68261L5.67979 4.35762L5.45376 4.68261ZM19.0538 11.4823L18.8278 11.8073L19.0538 11.4823ZM19.4034 10.0574L19.7534 9.87235L19.4034 10.0574ZM5.85376 3.43261L6.07979 3.10762L5.85376 3.43261ZM6.00376 13.9326L5.77773 14.2576L6.00376 13.9326ZM5.87879 12.1313L5.22773 5.00761L4.22773 5.10761L4.87879 12.2313L5.87879 12.1313ZM5.42773 12.7813L5.77773 14.2576L6.72979 14.0076L6.37979 12.5313L5.42773 12.7813ZM19.2798 11.1573L5.67979 4.35762L5.22773 5.00761L18.8278 11.8073L19.2798 11.1573ZM5.67979 4.35762C4.92979 3.88262 4.02979 4.53262 4.22773 5.10761L5.22773 4.85761C5.22773 4.88261 5.20273 4.88261 5.20273 4.85761C5.20273 4.83261 5.20273 4.83261 5.22773 4.85761L5.67979 4.35762ZM18.8278 11.8073C19.5278 12.2073 19.5028 13.2573 18.7778 13.6073L19.2298 14.2073C20.6798 13.3573 20.7048 11.2573 19.2798 11.1573L18.8278 11.8073ZM5.77773 14.2576C6.00273 14.4326 6.32773 14.4326 6.57773 14.2826L6.12979 13.6076C6.15479 13.5826 6.17979 13.6076 6.17979 13.6076C6.17979 13.6326 6.15479 13.6326 6.12979 13.6076L5.77773 14.2576ZM4.87879 12.2313C4.92879 12.3813 5.02879 12.5063 5.17773 12.5813L5.62979 11.9063C5.62979 11.9063 5.65479 11.9313 5.67979 11.9563C5.70479 12.0063 5.72979 12.0563 5.72979 12.1063L4.87879 12.2313Z"
          fill={user.color}
        />
        <path
          d="M5.22773 5.00761L5.87879 12.1313L6.37979 12.5313L6.72979 14.0076L18.7778 13.6073L5.22773 5.00761Z"
          fill={user.color}
          fillOpacity="0.3"
        />
      </svg>

      {/* User Name Label */}
      <div
        className="absolute left-4 top-4 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
    </div>
  );
}

// ============================================================================
// CursorPresence Component
// ============================================================================

export function CursorPresence({
  users,
  currentUserId,
  containerRef,
  className,
}: CursorPresenceProps) {
  const [containerRect, setContainerRect] = React.useState<DOMRect | null>(null);

  // Update container rect on mount and resize
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateRect = () => {
      setContainerRect(container.getBoundingClientRect());
    };

    updateRect();

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(container);

    window.addEventListener('scroll', updateRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect);
    };
  }, [containerRef]);

  // Filter out current user and users without cursors
  const otherUsers = React.useMemo(() => {
    return users.filter(
      (user) => user.id !== currentUserId && user.cursor
    );
  }, [users, currentUserId]);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {otherUsers.map((user) => (
        <Cursor key={user.id} user={user} containerRect={containerRect} />
      ))}
    </div>
  );
}

export default CursorPresence;
