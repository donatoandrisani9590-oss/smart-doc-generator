/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token from email.
 * Token is read from URL query parameter ?token=...
 */

import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").trim();

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    if (!token) {
      setError("Ungültiger Reset-Link. Bitte fordern Sie einen neuen an.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Passwort konnte nicht zurückgesetzt werden.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
        <Card className="shadow-xl border-0 w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ungültiger Link</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Der Reset-Link ist ungültig oder fehlt. Bitte fordern Sie einen neuen an.
            </p>
            <Link to="/forgot-password">
              <Button>Neuen Link anfordern</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-400">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">
              Neues Passwort setzen
            </CardTitle>
            <CardDescription className="text-center">
              Geben Sie Ihr neues Passwort ein.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="text-center py-4 animate-in fade-in duration-200">
                <CheckCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Passwort geändert</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.
                </p>
                <Link to="/login">
                  <Button className="w-full" size="lg">
                    Zur Anmeldung
                  </Button>
                </Link>
              </div>
            ) : (
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
                  <Label htmlFor="password">Neues Passwort</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 12 Zeichen"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      autoComplete="new-password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min. 12 Zeichen, Groß-/Kleinbuchstaben, Ziffer, Sonderzeichen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Passwort bestätigen</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Speichere...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Passwort speichern
                    </>
                  )}
                </Button>
              </form>
            )}

            {!success && (
              <div className="mt-6 text-center text-sm">
                <Link to="/login" className="text-primary hover:underline font-medium">
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Zurück zur Anmeldung
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
