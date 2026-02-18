/**
 * Document Lock Banner - Shows lock status on document detail page
 *
 * Displays:
 * - "Locked by X" warning when another user has the lock
 * - "You are editing" info when current user has the lock
 * - Auto-heartbeat to keep own lock alive
 * - Admin force-release button for stuck locks
 */

import React, { useEffect, useRef } from "react";
import { Lock, Unlock, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  useDocumentLockStatus,
  useForceReleaseLock,
  useLockHeartbeat,
} from "@/hooks/api/useDocumentQueries";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentLockBannerProps {
  documentId: number;
  onLockStatusChange?: (isLocked: boolean, isOwnLock: boolean) => void;
}

export const DocumentLockBanner: React.FC<DocumentLockBannerProps> = ({
  documentId,
  onLockStatusChange,
}) => {
  const { user } = useAuth();
  const { data: lockStatus, isLoading } = useDocumentLockStatus(documentId);
  const forceRelease = useForceReleaseLock();
  const heartbeat = useLockHeartbeat();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = user?.role === "admin";

  // Send heartbeat every 5 minutes to keep own lock alive
  useEffect(() => {
    if (lockStatus?.is_locked && lockStatus?.is_own_lock) {
      heartbeatRef.current = setInterval(() => {
        heartbeat.mutate(documentId);
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- heartbeat mutation object recreated each render; only re-run on lock state change
  }, [lockStatus?.is_locked, lockStatus?.is_own_lock, documentId]);

  // Notify parent about lock status changes
  useEffect(() => {
    if (lockStatus && onLockStatusChange) {
      onLockStatusChange(lockStatus.is_locked, lockStatus.is_own_lock);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to specific lock status fields, not entire lockStatus object
  }, [lockStatus?.is_locked, lockStatus?.is_own_lock, onLockStatusChange]);

  if (isLoading || !lockStatus || !lockStatus.is_locked) {
    return null;
  }

  const lockedAt = lockStatus.locked_at
    ? new Date(lockStatus.locked_at).toLocaleString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "";

  // Current user's lock - show info banner
  if (lockStatus.is_own_lock) {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <Lock className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-sm">
            <strong>Sie bearbeiten dieses Dokument.</strong> Die Sperre wird
            automatisch aufgehoben, wenn Sie fertig sind.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Another user's lock - show warning
  return (
    <Alert variant="destructive" className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          <strong>
            Gesperrt von {lockStatus.locked_by_name || lockStatus.locked_by_email}
          </strong>
          {lockedAt && <span className="text-amber-700 dark:text-amber-400 ml-1">seit {lockedAt}</span>}
          <span className="text-amber-700 dark:text-amber-400 block mt-0.5">
            Das Dokument kann derzeit nicht bearbeitet werden.
          </span>
        </span>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300"
            onClick={() => forceRelease.mutate(documentId)}
            disabled={forceRelease.isPending}
          >
            <Unlock className="h-3 w-3 mr-1" />
            Sperre aufheben
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default DocumentLockBanner;
