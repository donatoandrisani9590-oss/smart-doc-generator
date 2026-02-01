'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CollaborationUser } from '@/lib/collaboration';

// ============================================================================
// Types
// ============================================================================

interface UserAvatarsProps {
  users: CollaborationUser[];
  currentUserId?: string;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  showCurrentUser?: boolean;
  className?: string;
}

interface SingleAvatarProps {
  user: CollaborationUser;
  isCurrentUser: boolean;
  size: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

// ============================================================================
// Size Configuration
// ============================================================================

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

const overlapClasses = {
  sm: '-ml-2',
  md: '-ml-3',
  lg: '-ml-4',
};

const ringClasses = {
  sm: 'ring-1',
  md: 'ring-2',
  lg: 'ring-2',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ============================================================================
// Single Avatar Component
// ============================================================================

function SingleAvatar({ user, isCurrentUser, size, style }: SingleAvatarProps) {
  const initials = getInitials(user.name);
  const textColor = getContrastColor(user.color);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar
            className={cn(
              sizeClasses[size],
              ringClasses[size],
              'ring-background cursor-default transition-transform hover:z-10 hover:scale-110',
              isCurrentUser && 'ring-primary'
            )}
            style={style}
          >
            <AvatarImage src={undefined} alt={user.name} />
            <AvatarFallback
              className="font-medium"
              style={{
                backgroundColor: user.color,
                color: textColor,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-sm">
          <span>{user.name}</span>
          {isCurrentUser && (
            <span className="ml-1 text-muted-foreground">(You)</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Overflow Indicator Component
// ============================================================================

interface OverflowIndicatorProps {
  count: number;
  hiddenUsers: CollaborationUser[];
  size: 'sm' | 'md' | 'lg';
}

function OverflowIndicator({ count, hiddenUsers, size }: OverflowIndicatorProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar
            className={cn(
              sizeClasses[size],
              ringClasses[size],
              overlapClasses[size],
              'ring-background cursor-default bg-muted'
            )}
          >
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              +{count}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {count} more {count === 1 ? 'user' : 'users'}
            </p>
            <ul className="text-xs text-muted-foreground">
              {hiddenUsers.slice(0, 5).map((user) => (
                <li key={user.id}>{user.name}</li>
              ))}
              {hiddenUsers.length > 5 && (
                <li>and {hiddenUsers.length - 5} more...</li>
              )}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// UserAvatars Component
// ============================================================================

export function UserAvatars({
  users,
  currentUserId,
  maxVisible = 5,
  size = 'md',
  showCurrentUser = true,
  className,
}: UserAvatarsProps) {
  // Sort users to put current user first
  const sortedUsers = React.useMemo(() => {
    if (!currentUserId) return users;

    return [...users].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return 0;
    });
  }, [users, currentUserId]);

  // Filter out current user if not showing
  const displayUsers = React.useMemo(() => {
    if (showCurrentUser) return sortedUsers;
    return sortedUsers.filter((user) => user.id !== currentUserId);
  }, [sortedUsers, currentUserId, showCurrentUser]);

  // Split into visible and hidden users
  const visibleUsers = displayUsers.slice(0, maxVisible);
  const hiddenUsers = displayUsers.slice(maxVisible);
  const hasOverflow = hiddenUsers.length > 0;

  if (displayUsers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex items-center', className)}
      role="group"
      aria-label={`${displayUsers.length} ${displayUsers.length === 1 ? 'user' : 'users'} online`}
    >
      {visibleUsers.map((user, index) => (
        <div
          key={user.id}
          className={cn(index > 0 && overlapClasses[size])}
          style={{ zIndex: visibleUsers.length - index }}
        >
          <SingleAvatar
            user={user}
            isCurrentUser={user.id === currentUserId}
            size={size}
          />
        </div>
      ))}

      {hasOverflow && (
        <OverflowIndicator
          count={hiddenUsers.length}
          hiddenUsers={hiddenUsers}
          size={size}
        />
      )}
    </div>
  );
}

// ============================================================================
// Compact User List (Alternative View)
// ============================================================================

interface UserListProps {
  users: CollaborationUser[];
  currentUserId?: string;
  className?: string;
}

export function UserList({ users, currentUserId, className }: UserListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Online ({users.length})
      </p>
      <ul className="space-y-1">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const initials = getInitials(user.name);
          const textColor = getContrastColor(user.color);

          return (
            <li
              key={user.id}
              className="flex items-center gap-2 text-sm"
            >
              <Avatar className="h-6 w-6 text-xs">
                <AvatarFallback
                  style={{
                    backgroundColor: user.color,
                    color: textColor,
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className={cn(isCurrentUser && 'font-medium')}>
                {user.name}
                {isCurrentUser && (
                  <span className="ml-1 text-muted-foreground">(You)</span>
                )}
              </span>
              {/* Online indicator */}
              <span
                className="ml-auto h-2 w-2 rounded-full bg-green-500"
                aria-label="Online"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// Connection Status Indicator
// ============================================================================

interface ConnectionStatusProps {
  isConnected: boolean;
  isSynced: boolean;
  className?: string;
}

export function ConnectionStatus({
  isConnected,
  isSynced,
  className,
}: ConnectionStatusProps) {
  const status = React.useMemo(() => {
    if (!isConnected) {
      return {
        label: 'Disconnected',
        color: 'bg-destructive',
        textColor: 'text-destructive',
      };
    }
    if (!isSynced) {
      return {
        label: 'Syncing...',
        color: 'bg-yellow-500',
        textColor: 'text-yellow-600',
      };
    }
    return {
      label: 'Connected',
      color: 'bg-green-500',
      textColor: 'text-green-600',
    };
  }, [isConnected, isSynced]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              status.textColor,
              className
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                status.color,
                !isConnected && 'animate-pulse'
              )}
            />
            <span className="sr-only">{status.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>{status.label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default UserAvatars;
