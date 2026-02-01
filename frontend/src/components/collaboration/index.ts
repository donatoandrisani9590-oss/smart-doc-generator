// Collaboration Components - Phase 2: Async
export { CommentThread, type CommentThreadProps } from './CommentThread';
export { MentionInput, type MentionInputProps } from './MentionInput';
export { CommentSidebar, CommentToggleButton, type CommentSidebarProps } from './CommentSidebar';

// Collaboration Components - Phase 3: Real-Time (existing)
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
