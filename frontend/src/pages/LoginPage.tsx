/**
 * Login Page - Benutzeranmeldung
 *
 * Features:
 * - Email/Passwort Login
 * - Fehlerbehandlung
 * - Automatische Weiterleitung nach Login
 * - Responsive Design
 */

import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// SSO Provider Icons
const SSOIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => {
  if (icon === "microsoft") {
    return (
      <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
        <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
      </svg>
    );
  }
  if (icon === "google") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }
  return <Shield className={className} />;
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, ssoEnabled, ssoProviders } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for SSO error in URL params
  const searchParams = new URLSearchParams(location.search);
  const ssoError = searchParams.get("sso_error");

  // Get redirect path from location state or default to home
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Bitte geben Sie E-Mail und Passwort ein.");
      return;
    }

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err?.message === "2FA_REQUIRED" && err?.preAuthToken) {
        navigate("/2fa-verify", {
          state: { preAuthToken: err.preAuthToken, from },
          replace: true,
        });
        return;
      }
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen. Bitte versuchen Sie es erneut.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-400">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img
                src="/niederwieser-logo-blue.svg"
                alt="Niederwieser"
                className="h-10"
              />
            </div>

            <CardTitle className="text-2xl text-center font-bold">
              Willkommen
            </CardTitle>
            <CardDescription className="text-center">
              Melden Sie sich an, um auf das HR-Dokumentensystem zuzugreifen
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert (including SSO errors) */}
              {(error || ssoError) && (
                <div className="animate-in fade-in duration-200">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error || ssoError}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@niederwieser.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ihr Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Anmeldung...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Anmelden
                  </>
                )}
              </Button>
            </form>

            {/* SSO Login */}
            {ssoEnabled && ssoProviders.length > 0 && (
              <div className="mt-6">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-warm-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      oder anmelden mit
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {ssoProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="w-full gap-3 h-11 hover:bg-warm-50"
                      onClick={() => {
                        // Redirect to backend SSO authorize endpoint
                        const apiBase = (import.meta.env.VITE_API_URL || "").trim();
                        window.location.href = `${apiBase}${provider.authorize_url}`;
                      }}
                      disabled={isLoading}
                    >
                      <SSOIcon icon={provider.icon} className="h-5 w-5" />
                      <span>Mit {provider.label} anmelden</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Register Link */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Noch kein Konto? </span>
              <Link
                to="/register"
                className="text-primary hover:underline font-medium"
              >
                Registrieren
              </Link>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>niederwieser</p>
              <p className="text-xs mt-1">HR-Dokumentensystem</p>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Smart Document Generator v1.0
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
