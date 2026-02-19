/**
 * NotFound Page - 404 Error Page
 *
 * Zeigt eine benutzerfreundliche Fehlermeldung wenn eine Seite nicht gefunden wird.
 */

import { Link, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <Card className="max-w-md w-full text-center">
                <CardHeader>
                    <div className="text-8xl font-bold text-muted-foreground/30 mb-4">404</div>
                    <CardTitle className="text-xl">Seite nicht gefunden</CardTitle>
                    <CardDescription className="mt-2">
                        Die angeforderte Seite existiert nicht oder wurde verschoben.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Bitte überprüfe die URL oder navigiere zurück zur Startseite.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button asChild>
                            <Link to="/">
                                <Home className="w-4 h-4 mr-2" />
                                Zur Startseite
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Zurück
                        </Button>
                    </div>

                    <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">
                            Oder suche nach dem gewünschten Inhalt:
                        </p>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/search">
                                <Search className="w-4 h-4 mr-2" />
                                Zur Suche
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
