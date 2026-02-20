/**
 * ProtectedRoute – Redirects unauthenticated users to /login.
 *
 * Wraps around routes that require a logged-in user.
 * While auth state is loading it shows a minimal spinner.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin }: ProtectedRouteProps) => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // Still checking token – show spinner
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // Not authenticated – redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Admin-only route check
    if (requireAdmin && user?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
