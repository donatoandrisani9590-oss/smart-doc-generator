import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/layout/Layout";
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary";
// Auth
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { TwoFactorVerifyPage } from "@/pages/TwoFactorVerifyPage";
import { SSOCallbackPage } from "@/pages/SSOCallbackPage";
// Feature Settings (loaded once, shared globally)
import { FeatureSettingsProvider } from "@/contexts/FeatureSettingsContext";

// Lazy-loaded pages (code splitting)
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const DocumentGenerator = lazy(() => import("@/pages/DocumentGenerator").then(m => ({ default: m.DocumentGenerator })));
const SearchPage = lazy(() => import("@/pages/Search").then(m => ({ default: m.SearchPage })));
const TeamsPage = lazy(() => import("@/pages/Teams").then(m => ({ default: m.TeamsPage })));
const RepositoryPage = lazy(() => import("@/pages/Repository").then(m => ({ default: m.RepositoryPage })));
const DocumentDetailPage = lazy(() => import("@/pages/DocumentDetail").then(m => ({ default: m.DocumentDetailPage })));
const NotificationsPage = lazy(() => import("@/pages/Notifications").then(m => ({ default: m.NotificationsPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFound").then(m => ({ default: m.NotFoundPage })));
const DeadlinesCalendar = lazy(() => import("@/pages/DeadlinesCalendar"));
const BulkUploadPage = lazy(() => import("@/pages/BulkUpload"));
const SettingsHub = lazy(() => import("@/pages/SettingsHub"));
const AgentPage = lazy(() => import("@/pages/AgentPage"));
const GuestReviewPage = lazy(() => import("@/pages/GuestReviewPage"));

// Minimal loading fallback
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}


function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/2fa-verify" element={<TwoFactorVerifyPage />} />
              <Route path="/sso-callback" element={<SSOCallbackPage />} />
              {/* Public Guest Review (token-based, no auth) */}
              <Route path="/guest-review/:token" element={<GuestReviewPage />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <FeatureSettingsProvider>
                      <Layout />
                    </FeatureSettingsProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<PageErrorBoundary><Dashboard /></PageErrorBoundary>} />
                <Route path="generate" element={<PageErrorBoundary><DocumentGenerator /></PageErrorBoundary>} />
                <Route path="agent" element={<PageErrorBoundary><AgentPage /></PageErrorBoundary>} />
                <Route path="bulk" element={<PageErrorBoundary><BulkUploadPage /></PageErrorBoundary>} />
                {/* Legacy: /composer → /generate (v4.2 UX-Refactoring) */}
                <Route path="composer/*" element={<Navigate to="/generate" replace />} />
                <Route path="documents" element={<PageErrorBoundary><RepositoryPage /></PageErrorBoundary>} />
                <Route path="documents/:documentId" element={<PageErrorBoundary><DocumentDetailPage /></PageErrorBoundary>} />
                <Route path="search" element={<PageErrorBoundary><SearchPage /></PageErrorBoundary>} />
                <Route path="teams" element={<PageErrorBoundary><TeamsPage /></PageErrorBoundary>} />
                <Route path="deadlines" element={<PageErrorBoundary><DeadlinesCalendar /></PageErrorBoundary>} />
                <Route path="notifications" element={<PageErrorBoundary><NotificationsPage /></PageErrorBoundary>} />

                {/* UX-Refactoring: Neuer Settings-Hub */}
                <Route path="settings" element={<PageErrorBoundary><SettingsHub /></PageErrorBoundary>} />

                {/* Legacy Admin Routes - Redirect zum Settings-Hub */}
                <Route path="admin/company-settings" element={<Navigate to="/settings?tab=general" replace />} />
                <Route path="admin/settings" element={<Navigate to="/settings?tab=design" replace />} />
                <Route path="admin/clauses" element={<Navigate to="/settings?tab=clauses" replace />} />
                <Route path="admin/attachments" element={<Navigate to="/settings?tab=attachments" replace />} />
                <Route path="admin/types" element={<Navigate to="/settings?tab=templates" replace />} />
                <Route path="admin/document-designer" element={<Navigate to="/settings?tab=designer" replace />} />
                <Route path="admin/form-fields" element={<Navigate to="/settings?tab=form-fields" replace />} />
                <Route path="admin/template-preview" element={<Navigate to="/settings?tab=preview" replace />} />
                <Route path="admin/users" element={<Navigate to="/settings?tab=users" replace />} />
                <Route path="admin/works-council" element={<Navigate to="/settings?tab=works-council" replace />} />
                <Route path="admin/retention" element={<Navigate to="/settings?tab=retention" replace />} />
                <Route path="admin/audit" element={<Navigate to="/settings?tab=audit" replace />} />
                <Route path="admin/clause-approvals" element={<Navigate to="/settings?tab=approvals" replace />} />
                {/* Catch-all for any other /admin/* routes */}
                <Route path="admin/*" element={<Navigate to="/settings" replace />} />
                <Route path="templates" element={<Navigate to="/settings?tab=templates" replace />} />

                {/* 404 Catch-all Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
