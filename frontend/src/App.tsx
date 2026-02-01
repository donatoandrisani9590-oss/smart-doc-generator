import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { DocumentGenerator } from "@/pages/DocumentGenerator";
import { SearchPage } from "@/pages/Search";
import { TeamsPage } from "@/pages/Teams";
import { RepositoryPage } from "@/pages/Repository";
import { DocumentDetailPage } from "@/pages/DocumentDetail";
import { NotificationsPage } from "@/pages/Notifications";
import { NotFoundPage } from "@/pages/NotFound";
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary";
import DeadlinesCalendar from "@/pages/DeadlinesCalendar";
import { BulkUploadPage } from "@/pages/BulkUpload";
// UX-Refactoring: Neuer Settings-Hub (enthält alle Admin-Seiten)
import SettingsHub from "@/pages/SettingsHub";
// Auth
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
// Feature Settings (loaded once, shared globally)
import { FeatureSettingsProvider } from "@/contexts/FeatureSettingsContext";

// Redirect-Komponente für /composer/:draftId → /generate?draft=:draftId
const ComposerDraftRedirect = () => {
  const { draftId } = useParams<{ draftId: string }>();
  return <Navigate to={`/generate?draft=${draftId}`} replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

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
              <Route path="bulk" element={<PageErrorBoundary><BulkUploadPage /></PageErrorBoundary>} />
              {/* Composer versteckt - Redirect zu /generate (v4.2 UX-Refactoring) */}
              <Route path="composer" element={<Navigate to="/generate" replace />} />
              <Route path="composer/:draftId" element={<ComposerDraftRedirect />} />
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
              <Route path="admin/attachments" element={<Navigate to="/settings?tab=advanced&section=attachments" replace />} />
              <Route path="admin/types" element={<Navigate to="/settings?tab=templates" replace />} />
              <Route path="admin/document-designer" element={<Navigate to="/settings?tab=advanced&section=designer" replace />} />
              <Route path="admin/form-fields" element={<Navigate to="/settings?tab=advanced&section=form-fields" replace />} />
              <Route path="admin/template-preview" element={<Navigate to="/settings?tab=advanced&section=preview" replace />} />
              <Route path="admin/users" element={<Navigate to="/settings?tab=advanced&section=users" replace />} />
              <Route path="admin/works-council" element={<Navigate to="/settings?tab=advanced&section=works-council" replace />} />
              <Route path="admin/retention" element={<Navigate to="/settings?tab=advanced&section=retention" replace />} />
              <Route path="admin/audit" element={<Navigate to="/settings?tab=advanced&section=audit" replace />} />
              <Route path="admin/clause-approvals" element={<Navigate to="/settings?tab=advanced&section=approvals" replace />} />
              {/* Catch-all for any other /admin/* routes */}
              <Route path="admin/*" element={<Navigate to="/settings" replace />} />

              {/* 404 Catch-all Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
