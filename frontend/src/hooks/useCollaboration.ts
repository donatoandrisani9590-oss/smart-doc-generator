'use client';

import * as React from 'react';
import {
  CollaborationManager,
  createCollaborationManager,
  type CollaborationUser,
  type CollaborationConfig,
} from '@/lib/collaboration';

// ============================================================================
// Types
// ============================================================================

export interface UseCollaborationOptions {
  documentId: string;
  user: {
    id: string;
    name: string;
  };
  config?: CollaborationConfig;
  autoConnect?: boolean;
}

export interface UseCollaborationReturn {
  // State
  users: CollaborationUser[];
  isConnected: boolean;
  isSynced: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;
  updateCursor: (position: { x: number; y: number } | null) => void;
  getManager: () => CollaborationManager | null;

  // Computed
  isCurrentUserOnly: boolean;
  otherUsers: CollaborationUser[];
  currentUser: CollaborationUser | undefined;
}

// ============================================================================
// useCollaboration Hook
// ============================================================================

export function useCollaboration({
  documentId,
  user,
  config,
  autoConnect = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  // Manager ref to persist across renders
  const managerRef = React.useRef<CollaborationManager | null>(null);

  // State
  const [users, setUsers] = React.useState<CollaborationUser[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSynced, setIsSynced] = React.useState(false);

  // Memoize user object to prevent unnecessary re-renders
  const userId = user.id;
  const userName = user.name;

  // Initialize manager
  React.useEffect(() => {
    // Create new manager
    const manager = createCollaborationManager(
      documentId,
      { id: userId, name: userName },
      config
    );
    managerRef.current = manager;

    // Subscribe to events
    const unsubUsers = manager.onUsersChange((newUsers) => {
      setUsers(newUsers);
    });

    const unsubConnection = manager.onConnection((connected) => {
      setIsConnected(connected);
    });

    const unsubSync = manager.onSync((synced) => {
      setIsSynced(synced);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      manager.connect();
    }

    // Cleanup
    return () => {
      unsubUsers();
      unsubConnection();
      unsubSync();
      manager.destroy();
      managerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, userId, userName, autoConnect]);

  // Memoized actions
  const connect = React.useCallback(() => {
    managerRef.current?.connect();
  }, []);

  const disconnect = React.useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  const updateCursor = React.useCallback(
    (position: { x: number; y: number } | null) => {
      managerRef.current?.updateCursor(position);
    },
    []
  );

  const getManager = React.useCallback(() => {
    return managerRef.current;
  }, []);

  // Computed values
  const currentUser = React.useMemo(() => {
    return users.find((u) => u.id === user.id);
  }, [users, user.id]);

  const otherUsers = React.useMemo(() => {
    return users.filter((u) => u.id !== user.id);
  }, [users, user.id]);

  const isCurrentUserOnly = React.useMemo(() => {
    return users.length <= 1;
  }, [users.length]);

  return {
    // State
    users,
    isConnected,
    isSynced,

    // Actions
    connect,
    disconnect,
    updateCursor,
    getManager,

    // Computed
    isCurrentUserOnly,
    otherUsers,
    currentUser,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useCollaboration;
