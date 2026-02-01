import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

// ============================================================================
// Types
// ============================================================================

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  lastActive?: number;
}

export interface CollaborationState {
  users: CollaborationUser[];
  isConnected: boolean;
  isSynced: boolean;
}

export interface CollaborationConfig {
  wsUrl?: string;
  enablePersistence?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

type UsersChangeCallback = (users: CollaborationUser[]) => void;
type SyncCallback = (isSynced: boolean) => void;
type ConnectionCallback = (isConnected: boolean) => void;

// ============================================================================
// Color Generation
// ============================================================================

const COLLABORATION_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#10B981', // emerald
];

function generateUserColor(userId: string): string {
  // Generate consistent color based on user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % COLLABORATION_COLORS.length;
  return COLLABORATION_COLORS[index];
}

// ============================================================================
// CollaborationManager Class
// ============================================================================

export class CollaborationManager {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private documentId: string;
  private user: { id: string; name: string };
  private config: CollaborationConfig;

  // Callbacks
  private usersChangeCallbacks: Set<UsersChangeCallback> = new Set();
  private syncCallbacks: Set<SyncCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  // State
  private _isConnected: boolean = false;
  private _isSynced: boolean = false;
  private _users: CollaborationUser[] = [];

  constructor(
    documentId: string,
    user: { id: string; name: string },
    config: CollaborationConfig = {}
  ) {
    this.documentId = documentId;
    this.user = user;
    this.config = {
      wsUrl: config.wsUrl || 'wss://demos.yjs.dev',
      enablePersistence: config.enablePersistence ?? true,
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
    };

    // Initialize Yjs document
    this.doc = new Y.Doc();

    // Setup local persistence if enabled
    if (this.config.enablePersistence) {
      this.setupPersistence();
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  get users(): CollaborationUser[] {
    return this._users;
  }

  get ydoc(): Y.Doc {
    return this.doc;
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  connect(wsUrl?: string): void {
    if (this.provider) {
      console.warn('[Collaboration] Already connected. Disconnect first.');
      return;
    }

    const url = wsUrl || this.config.wsUrl!;
    const roomName = `document-${this.documentId}`;

    try {
      this.provider = new WebsocketProvider(url, roomName, this.doc, {
        connect: true,
        params: {},
        WebSocketPolyfill: WebSocket,
        resyncInterval: 10000,
        maxBackoffTime: 2500,
        disableBc: false,
      });

      this.setupAwareness();
      this.setupConnectionListeners();

      console.log(`[Collaboration] Connecting to ${url} for room ${roomName}`);
    } catch (error) {
      console.error('[Collaboration] Failed to connect:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.provider) {
      // Clear awareness before disconnecting
      this.provider.awareness.setLocalState(null);
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
    }

    this._isConnected = false;
    this._users = [];

    this.notifyConnectionChange(false);
    this.notifyUsersChange([]);

    console.log('[Collaboration] Disconnected');
  }

  destroy(): void {
    this.disconnect();

    if (this.persistence) {
      this.persistence.destroy();
      this.persistence = null;
    }

    this.doc.destroy();

    this.usersChangeCallbacks.clear();
    this.syncCallbacks.clear();
    this.connectionCallbacks.clear();

    console.log('[Collaboration] Destroyed');
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  private setupPersistence(): void {
    try {
      this.persistence = new IndexeddbPersistence(
        `collaboration-${this.documentId}`,
        this.doc
      );

      this.persistence.on('synced', () => {
        console.log('[Collaboration] Local persistence synced');
      });
    } catch (error) {
      console.error('[Collaboration] Failed to setup persistence:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Awareness (Online Users)
  // --------------------------------------------------------------------------

  private setupAwareness(): void {
    if (!this.provider) return;

    const awareness = this.provider.awareness;

    // Set local user state
    awareness.setLocalState({
      user: {
        id: this.user.id,
        name: this.user.name,
        color: generateUserColor(this.user.id),
      },
      cursor: null,
      lastActive: Date.now(),
    });

    // Listen for awareness changes
    awareness.on('change', () => {
      this.updateUsers();
    });

    // Update lastActive periodically
    const activityInterval = setInterval(() => {
      if (!this.provider) {
        clearInterval(activityInterval);
        return;
      }

      const currentState = awareness.getLocalState();
      if (currentState) {
        awareness.setLocalStateField('lastActive', Date.now());
      }
    }, 30000); // Every 30 seconds
  }

  private updateUsers(): void {
    if (!this.provider) {
      this._users = [];
      this.notifyUsersChange([]);
      return;
    }

    const awareness = this.provider.awareness;
    const states = awareness.getStates();
    const users: CollaborationUser[] = [];

    states.forEach((state) => {
      if (state.user) {
        users.push({
          id: state.user.id,
          name: state.user.name,
          color: state.user.color,
          cursor: state.cursor || undefined,
          lastActive: state.lastActive,
        });
      }
    });

    this._users = users;
    this.notifyUsersChange(users);
  }

  getUsers(): CollaborationUser[] {
    return this._users;
  }

  updateCursor(position: { x: number; y: number } | null): void {
    if (!this.provider) return;

    this.provider.awareness.setLocalStateField('cursor', position);
  }

  // --------------------------------------------------------------------------
  // Connection Listeners
  // --------------------------------------------------------------------------

  private setupConnectionListeners(): void {
    if (!this.provider) return;

    // Connection status
    this.provider.on('status', (event: { status: string }) => {
      const isConnected = event.status === 'connected';
      this._isConnected = isConnected;
      this.notifyConnectionChange(isConnected);

      console.log(`[Collaboration] Status: ${event.status}`);
    });

    // Sync status
    this.provider.on('sync', (isSynced: boolean) => {
      this._isSynced = isSynced;
      this.notifySyncChange(isSynced);

      console.log(`[Collaboration] Synced: ${isSynced}`);
    });

    // Connection close
    this.provider.on('connection-close', () => {
      console.log('[Collaboration] Connection closed');
    });

    // Connection error
    this.provider.on('connection-error', (event: Event) => {
      console.error('[Collaboration] Connection error:', event);
    });
  }

  // --------------------------------------------------------------------------
  // Shared Data Structures
  // --------------------------------------------------------------------------

  getSharedMap<T>(name: string): Y.Map<T> {
    return this.doc.getMap<T>(name);
  }

  getSharedArray<T>(name: string): Y.Array<T> {
    return this.doc.getArray<T>(name);
  }

  getSharedText(name: string): Y.Text {
    return this.doc.getText(name);
  }

  getSharedXmlFragment(name: string): Y.XmlFragment {
    return this.doc.getXmlFragment(name);
  }

  // --------------------------------------------------------------------------
  // Event Subscriptions
  // --------------------------------------------------------------------------

  onUsersChange(callback: UsersChangeCallback): () => void {
    this.usersChangeCallbacks.add(callback);

    // Immediately call with current users
    callback(this._users);

    return () => {
      this.usersChangeCallbacks.delete(callback);
    };
  }

  onSync(callback: SyncCallback): () => void {
    this.syncCallbacks.add(callback);

    // Immediately call with current sync state
    callback(this._isSynced);

    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  onConnection(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);

    // Immediately call with current connection state
    callback(this._isConnected);

    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  // --------------------------------------------------------------------------
  // Notification Helpers
  // --------------------------------------------------------------------------

  private notifyUsersChange(users: CollaborationUser[]): void {
    this.usersChangeCallbacks.forEach((callback) => {
      try {
        callback(users);
      } catch (error) {
        console.error('[Collaboration] Error in users change callback:', error);
      }
    });
  }

  private notifySyncChange(isSynced: boolean): void {
    this.syncCallbacks.forEach((callback) => {
      try {
        callback(isSynced);
      } catch (error) {
        console.error('[Collaboration] Error in sync callback:', error);
      }
    });
  }

  private notifyConnectionChange(isConnected: boolean): void {
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('[Collaboration] Error in connection callback:', error);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  getDocumentState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  /**
   * Force reconnect to the WebSocket server
   */
  reconnect(): void {
    if (this.provider) {
      this.provider.disconnect();
      setTimeout(() => {
        this.provider?.connect();
      }, 100);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCollaborationManager(
  documentId: string,
  user: { id: string; name: string },
  config?: CollaborationConfig
): CollaborationManager {
  return new CollaborationManager(documentId, user, config);
}

// ============================================================================
// Exports
// ============================================================================

export { generateUserColor, COLLABORATION_COLORS };
