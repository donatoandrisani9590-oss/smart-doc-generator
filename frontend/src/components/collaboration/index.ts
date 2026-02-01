// Collaboration Components
export { CursorPresence } from './CursorPresence';
export {
  UserAvatars,
  UserList,
  ConnectionStatus,
} from './UserAvatars';

// Re-export types from lib
export type {
  CollaborationUser,
  CollaborationState,
  CollaborationConfig,
} from '@/lib/collaboration';

// Re-export manager from lib
export {
  CollaborationManager,
  createCollaborationManager,
  generateUserColor,
  COLLABORATION_COLORS,
} from '@/lib/collaboration';
