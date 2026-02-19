/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 * Always shows success to prevent user enumeration.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").trim();

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Ignore errors - always show success
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-400">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold">
              Passwort vergessen?
            </CardTitle>
            <CardDescription className="text-center">
              Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="text-center py-4 animate-in fade-in duration-200">
                <CheckCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">E-Mail gesendet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Falls ein Konto mit <strong>{email}</strong> existiert, haben wir eine E-Mail mit einem Link zum Zurücksetzen gesendet.
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Zurück zur Anmeldung
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@niederwieser.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sende...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Link senden
                    </>
                  )}
                </Button>
              </form>
            )}

            {!submitted && (
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

export default ForgotPasswordPage;
