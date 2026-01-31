/**
 * User Management Page
 *
 * Admin page for managing users - view, create, edit roles, activate/deactivate
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Users,
    UserPlus,
    Shield,
    Search,
    MoreVertical,
    Pencil,
    UserX,
    UserCheck,
    Key,
    Loader2,
    AlertCircle,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";

interface User {
    id: number;
    email: string;
    role: string;
    country_code: string | null;
    is_active: boolean;
    created_at: string | null;
}

interface UserStats {
    total_users: number;
    active_users: number;
    inactive_users: number;
    admin_users: number;
    regular_users: number;
}

export const UsersPage = () => {
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Dialogs
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        role: "user",
        country_code: "DE",
    });
    const [newPassword, setNewPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Fetch users
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append("search", searchQuery);
            if (roleFilter !== "all") params.append("role", roleFilter);
            if (statusFilter !== "all") params.append("is_active", statusFilter === "active" ? "true" : "false");

            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/users?${params.toString()}`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) throw new Error("Fehler beim Laden der Benutzer");

            const data = await response.json();
            setUsers(data.users);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setLoading(false);
        }
    };

    // Fetch stats
    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/v1/users/stats/summary", {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, [searchQuery, roleFilter, statusFilter]);

    // Create user
    const handleCreateUser = async () => {
        try {
            setSubmitting(true);
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/v1/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Fehler beim Erstellen");
            }

            setCreateDialogOpen(false);
            setFormData({ email: "", password: "", role: "user", country_code: "DE" });
            fetchUsers();
            fetchStats();
            toast.success("Benutzer erstellt", `${formData.email} wurde erfolgreich angelegt`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
            setError(message);
            toast.error("Fehler", message);
        } finally {
            setSubmitting(false);
        }
    };

    // Update user
    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        try {
            setSubmitting(true);
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/users/${selectedUser.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    role: formData.role,
                    country_code: formData.country_code,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Fehler beim Aktualisieren");
            }

            setEditDialogOpen(false);
            setSelectedUser(null);
            fetchUsers();
            fetchStats();
            toast.success("Benutzer aktualisiert", "Die Änderungen wurden gespeichert");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Fehler beim Aktualisieren";
            setError(message);
            toast.error("Fehler", message);
        } finally {
            setSubmitting(false);
        }
    };

    // Toggle user active status
    const handleToggleActive = async (user: User) => {
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/users/${user.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ is_active: !user.is_active }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Fehler beim Aktualisieren");
            }

            fetchUsers();
            fetchStats();
            toast.success(
                user.is_active ? "Benutzer deaktiviert" : "Benutzer aktiviert",
                `${user.email} wurde ${user.is_active ? "deaktiviert" : "aktiviert"}`
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : "Fehler beim Aktualisieren";
            setError(message);
            toast.error("Fehler", message);
        }
    };

    // Reset password
    const handleResetPassword = async () => {
        if (!selectedUser) return;

        try {
            setSubmitting(true);
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/users/${selectedUser.id}/reset-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ new_password: newPassword }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Fehler beim Zurücksetzen");
            }

            setResetPasswordDialogOpen(false);
            setSelectedUser(null);
            setNewPassword("");
            toast.success("Passwort zurückgesetzt", `Das Passwort für ${selectedUser.email} wurde geändert`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Fehler beim Zurücksetzen";
            setError(message);
            toast.error("Fehler", message);
        } finally {
            setSubmitting(false);
        }
    };

    const openEditDialog = (user: User) => {
        setSelectedUser(user);
        setFormData({
            ...formData,
            role: user.role,
            country_code: user.country_code || "DE",
        });
        setEditDialogOpen(true);
    };

    const openResetPasswordDialog = (user: User) => {
        setSelectedUser(user);
        setNewPassword("");
        setResetPasswordDialogOpen(true);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Benutzerverwaltung
                    </h1>
                    <p className="text-muted-foreground">
                        Verwalten Sie Benutzer und deren Berechtigungen
                    </p>
                </div>
                <Button
                    className="gap-2 bg-primary hover:bg-primary/90"
                    onClick={() => setCreateDialogOpen(true)}
                >
                    <UserPlus className="w-4 h-4" />
                    Benutzer anlegen
                </Button>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="ml-auto"
                    >
                        Schliessen
                    </Button>
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Gesamt</p>
                                    <p className="text-2xl font-bold text-foreground">{stats.total_users}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Aktiv</p>
                                    <p className="text-2xl font-bold text-secondary">{stats.active_users}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                                    <UserCheck className="w-5 h-5 text-secondary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Inaktiv</p>
                                    <p className="text-2xl font-bold text-muted-foreground">{stats.inactive_users}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-border/30 flex items-center justify-center">
                                    <UserX className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Admins</p>
                                    <p className="text-2xl font-bold text-primary">{stats.admin_users}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Benutzer & Rollen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="E-Mail suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Rolle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Rollen</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">Benutzer</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Status</SelectItem>
                                <SelectItem value="active">Aktiv</SelectItem>
                                <SelectItem value="inactive">Inaktiv</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Users Table */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Keine Benutzer gefunden
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>E-Mail</TableHead>
                                    <TableHead>Rolle</TableHead>
                                    <TableHead>Land</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Erstellt</TableHead>
                                    <TableHead className="text-right">Aktionen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={user.role === "admin" ? "default" : "secondary"}
                                                className={user.role === "admin" ? "bg-primary" : ""}
                                            >
                                                {user.role === "admin" ? "Admin" : "Benutzer"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{user.country_code || "-"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={user.is_active ? "default" : "secondary"}
                                                className={user.is_active ? "bg-secondary" : "bg-border text-muted-foreground"}
                                            >
                                                {user.is_active ? "Aktiv" : "Inaktiv"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatDate(user.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Bearbeiten
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                                                        <Key className="w-4 h-4 mr-2" />
                                                        Passwort zuruecksetzen
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                                        {user.is_active ? (
                                                            <>
                                                                <UserX className="w-4 h-4 mr-2" />
                                                                Deaktivieren
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserCheck className="w-4 h-4 mr-2" />
                                                                Aktivieren
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create User Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
                        <DialogDescription>
                            Erstellen Sie einen neuen Benutzer fuer das System.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-Mail</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="benutzer@firma.de"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Passwort</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Mindestens 8 Zeichen"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rolle</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">Benutzer</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Land</Label>
                                <Select
                                    value={formData.country_code}
                                    onValueChange={(value) => setFormData({ ...formData, country_code: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DE">Deutschland</SelectItem>
                                        <SelectItem value="IT">Italien</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleCreateUser}
                            disabled={submitting || !formData.email || !formData.password}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Erstellen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Benutzer bearbeiten</DialogTitle>
                        <DialogDescription>
                            {selectedUser?.email}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Rolle</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Benutzer</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Land</Label>
                            <Select
                                value={formData.country_code}
                                onValueChange={(value) => setFormData({ ...formData, country_code: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DE">Deutschland</SelectItem>
                                    <SelectItem value="IT">Italien</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleUpdateUser}
                            disabled={submitting}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Passwort zuruecksetzen</DialogTitle>
                        <DialogDescription>
                            Neues Passwort fuer {selectedUser?.email} setzen
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Neues Passwort</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mindestens 8 Zeichen"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleResetPassword}
                            disabled={submitting || newPassword.length < 8}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Passwort setzen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
