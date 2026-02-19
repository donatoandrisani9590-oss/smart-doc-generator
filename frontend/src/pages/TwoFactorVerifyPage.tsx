/**
 * Two-Factor Authentication Verification Page
 *
 * Shown after successful password login when 2FA is enabled.
 * User must enter TOTP code from their authenticator app.
 */

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").trim();
const TOKEN_KEY = "docgen_token";
const USER_KEY = "docgen_user";

export const TwoFactorVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preAuthToken = (location.state as { preAuthToken?: string })?.preAuthToken;
  const redirectTo = (location.state as { from?: string })?.from || "/";

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preAuthToken) {
      navigate("/login", { replace: true });
    }
    inputRef.current?.focus();
  }, [preAuthToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("Bitte gib den 6-stelligen Code ein.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_auth_token: preAuthToken, totp_code: code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Verifizierung fehlgeschlagen.");
      }

      const { access_token } = await res.json();

      // Fetch user data
      const userRes = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = await userRes.json();

      // Store and redirect
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifizierung fehlgeschlagen.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  const handleCodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setCode(cleaned);
  };

  if (!preAuthToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-400">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">
              Zwei-Faktor-Authentifizierung
            </CardTitle>
            <CardDescription className="text-center">
              Gib den 6-stelligen Code aus deiner Authenticator-App ein.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="animate-in fade-in duration-200">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  maxLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6} size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifiziere...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Bestätigen
                  </>
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Öffne deine Authenticator-App (z.B. Google Authenticator) und gib den aktuellen Code ein.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TwoFactorVerifyPage;
