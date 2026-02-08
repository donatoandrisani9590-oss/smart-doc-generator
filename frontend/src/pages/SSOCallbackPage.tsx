/**
 * SSO Callback Page - Handles the redirect from the SSO provider
 *
 * Flow:
 * 1. Backend redirects here with ?token=JWT after successful SSO auth
 * 2. We extract the token, validate it, store it, and redirect to dashboard
 * 3. On error (?sso_error=...), we show the error and redirect to login
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const SSOCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleSSOCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Check for SSO errors from provider
      const ssoError = searchParams.get("sso_error");
      if (ssoError) {
        setError(decodeURIComponent(ssoError));
        return;
      }

      // Extract token from URL
      const token = searchParams.get("token");
      if (!token) {
        setError("Kein Authentifizierungstoken erhalten.");
        return;
      }

      try {
        await handleSSOCallback(token);
        navigate("/", { replace: true });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "SSO-Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut."
        );
      }
    };

    processCallback();
  }, [searchParams, handleSSOCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100 dark:from-slate-900 dark:to-slate-950 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-xl text-center">
              SSO-Anmeldung fehlgeschlagen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              className="w-full"
              onClick={() => navigate("/login", { replace: true })}
            >
              Zurück zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state while processing SSO callback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium text-foreground">
            SSO-Anmeldung wird verarbeitet...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Bitte warten Sie einen Moment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SSOCallbackPage;
