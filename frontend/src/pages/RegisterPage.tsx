/**
 * Register Page - Benutzerregistrierung
 *
 * Features:
 * - Email/Passwort Registrierung
 * - Passwort-Bestätigung
 * - Fehlerbehandlung
 * - Auto-Login nach Registrierung
 * - Responsive Design
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, UserPlus, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password validation (must match backend policy: 12+ chars, upper, lower, digit, special)
  const passwordMinLength = password.length >= 12;
  const passwordHasUpper = /[A-Z]/.test(password);
  const passwordHasLower = /[a-z]/.test(password);
  const passwordHasDigit = /\d/.test(password);
  const passwordHasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(password);
  const passwordValid = passwordMinLength && passwordHasUpper && passwordHasLower && passwordHasDigit && passwordHasSpecial;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    if (!email || !password || !confirmPassword) {
      setError("Bitte füllen Sie alle Felder aus.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
      return;
    }

    // Validate password complexity (must match backend policy)
    const pwErrors: string[] = [];
    if (password.length < 12) pwErrors.push("mindestens 12 Zeichen");
    if (!/[A-Z]/.test(password)) pwErrors.push("einen Großbuchstaben");
    if (!/[a-z]/.test(password)) pwErrors.push("einen Kleinbuchstaben");
    if (!/\d/.test(password)) pwErrors.push("eine Ziffer");
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(password)) pwErrors.push("ein Sonderzeichen");
    if (pwErrors.length > 0) {
      setError(`Passwort benötigt: ${pwErrors.join(", ")}`);
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    try {
      await register({ email, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-600 dark:to-warm-600 p-4">
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
              Konto erstellen
            </CardTitle>
            <CardDescription className="text-center">
              Registrieren Sie sich für das HR-Dokumentensystem
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <div className="animate-in fade-in duration-200">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@beispiel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mind. 12 Zeichen, Groß-/Kleinbuchst., Ziffer, Sonderz."
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
                    aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {/* Password strength indicators */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    {[
                      { check: passwordMinLength, label: "Mindestens 12 Zeichen" },
                      { check: passwordHasUpper, label: "Großbuchstabe (A-Z)" },
                      { check: passwordHasLower, label: "Kleinbuchstabe (a-z)" },
                      { check: passwordHasDigit, label: "Ziffer (0-9)" },
                      { check: passwordHasSpecial, label: "Sonderzeichen (!@#$...)" },
                    ].map(({ check, label }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        {check ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={check ? "text-green-600" : "text-muted-foreground"}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {/* Password match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    {passwordsMatch ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordsMatch ? "text-green-600" : "text-red-500"}>
                      {passwordsMatch ? "Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !passwordValid || !passwordsMatch}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrierung...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Registrieren
                  </>
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Bereits ein Konto? </span>
              <Link
                to="/login"
                className="text-primary hover:underline font-medium"
              >
                Anmelden
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

export default RegisterPage;
