/**
 * Teams Page
 *
 * Manage teams, members, and shared documents.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Users,
    Plus,
    MoreVertical,
    Settings,
    UserPlus,
    LogOut,
    Trash2,
    Loader2,
    Crown,
    Shield,
    User,
    Eye,
    FileText,
    Share2,
    LayoutTemplate,
    Copy,
    Globe,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useMyTeams,
    useCreateTeam,
    useDeleteTeam,
    useTeamMembers,
    useAddTeamMember,
    useRemoveTeamMember,
    useTeamShares,
    useTeamTemplates,
    useCreateTeamTemplate,
    type Team,
    type TeamMember,
} from "@/hooks/useApi";
import { useCountry } from "@/hooks/useCountry";
import { useToast } from "@/components/ui/toast";
import { SkeletonTeamsList } from "@/components/ui/skeleton";

// Role icons and labels
const roleInfo: Record<string, { icon: typeof Crown; label: string; color: string }> = {
    owner: { icon: Crown, label: "Eigentümer", color: "text-yellow-600" },
    admin: { icon: Shield, label: "Administrator", color: "text-blue-600" },
    member: { icon: User, label: "Mitglied", color: "text-green-600" },
    viewer: { icon: Eye, label: "Betrachter", color: "text-muted-foreground" },
};

export const TeamsPage = () => {
    const { country: countryCode } = useCountry();
    const toast = useToast();
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [createTemplateDialogOpen, setCreateTemplateDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("members");

    // Form state
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDescription, setNewTeamDescription] = useState("");
    const [newMemberId, setNewMemberId] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("member");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateDescription, setNewTemplateDescription] = useState("");

    const { data: teams, isLoading } = useMyTeams(countryCode);
    const createTeamMutation = useCreateTeam();
    const deleteTeamMutation = useDeleteTeam();
    const addMemberMutation = useAddTeamMember();
    const removeMemberMutation = useRemoveTeamMember();

    // Fetch members for selected team
    const { data: members } = useTeamMembers(selectedTeam?.id ?? 0);
    const { data: shares } = useTeamShares(selectedTeam?.id ?? 0);
    const { data: templates } = useTeamTemplates(selectedTeam?.id ?? 0);
    const createTemplateMutation = useCreateTeamTemplate();

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;

        try {
            await createTeamMutation.mutateAsync({
                name: newTeamName,
                description: newTeamDescription || undefined,
                country_code: countryCode,
            });
            setCreateDialogOpen(false);
            setNewTeamName("");
            setNewTeamDescription("");
            toast.success("Team erstellt", `"${newTeamName}" wurde erfolgreich angelegt`);
        } catch {
            toast.error("Fehler", "Das Team konnte nicht erstellt werden");
        }
    };

    const handleAddMember = async () => {
        if (!selectedTeam || !newMemberId.trim()) return;

        try {
            await addMemberMutation.mutateAsync({
                teamId: selectedTeam.id,
                data: {
                    user_id: newMemberId,
                    role: newMemberRole as "admin" | "member" | "viewer",
                },
            });
            setAddMemberDialogOpen(false);
            setNewMemberId("");
            setNewMemberRole("member");
            toast.success("Mitglied hinzugefügt", `${newMemberId} wurde zum Team hinzugefügt`);
        } catch {
            toast.error("Fehler", "Das Mitglied konnte nicht hinzugefügt werden");
        }
    };

    const handleDeleteTeam = async () => {
        if (!selectedTeam) return;

        const teamName = selectedTeam.name;
        try {
            await deleteTeamMutation.mutateAsync(selectedTeam.id);
            setDeleteDialogOpen(false);
            setSelectedTeam(null);
            toast.success("Team gelöscht", `"${teamName}" wurde entfernt`);
        } catch {
            toast.error("Fehler", "Das Team konnte nicht gelöscht werden");
        }
    };

    const handleCreateTemplate = async () => {
        if (!selectedTeam || !newTemplateName.trim()) return;

        try {
            await createTemplateMutation.mutateAsync({
                teamId: selectedTeam.id,
                data: {
                    name: newTemplateName,
                    description: newTemplateDescription || undefined,
                    country_code: countryCode,
                },
            });
            setCreateTemplateDialogOpen(false);
            setNewTemplateName("");
            setNewTemplateDescription("");
            toast.success("Vorlage erstellt", `"${newTemplateName}" wurde für das Team erstellt`);
        } catch {
            toast.error("Fehler", "Die Vorlage konnte nicht erstellt werden");
        }
    };

    const handleRemoveMember = async (member: TeamMember) => {
        if (!selectedTeam) return;

        try {
            await removeMemberMutation.mutateAsync({
                teamId: selectedTeam.id,
                userId: member.user_id,
            });
            toast.success("Mitglied entfernt", `${member.user_id} wurde aus dem Team entfernt`);
        } catch {
            toast.error("Fehler", "Das Mitglied konnte nicht entfernt werden");
        }
    };

    const handleLeaveTeam = async () => {
        if (!selectedTeam) return;

        const teamName = selectedTeam.name;
        try {
            // Use "me" as special identifier - backend will resolve current user
            await removeMemberMutation.mutateAsync({
                teamId: selectedTeam.id,
                userId: "me",
            });
            setLeaveDialogOpen(false);
            setSelectedTeam(null);
            toast.info("Team verlassen", `Du hast "${teamName}" verlassen`);
        } catch {
            toast.error("Fehler", "Du konntest das Team nicht verlassen");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Teams</h1>
                    <p className="text-muted-foreground">
                        Verwalte deine Teams und teile Dokumente mit Kollegen
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Neues Team
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Teams List */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Meine Teams
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <SkeletonTeamsList items={3} />
                        ) : teams?.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <Users className="w-7 h-7 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium mb-1">Noch kein Team</h3>
                                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                                    Erstelle ein Team, um Dokumente mit Kollegen zu teilen.
                                </p>
                                <Button onClick={() => setCreateDialogOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Erstes Team erstellen
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {teams?.map((team) => {
                                    const RoleIcon = roleInfo[team.my_role || "member"]?.icon || User;
                                    const roleColor = roleInfo[team.my_role || "member"]?.color || "";

                                    return (
                                        <div
                                            key={team.id}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                                selectedTeam?.id === team.id
                                                    ? "bg-primary/10 border-primary"
                                                    : "hover:bg-muted/50"
                                            }`}
                                            onClick={() => setSelectedTeam(team)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">{team.name}</h3>
                                                    <p className="text-xs text-muted-foreground">
                                                            {team.member_count === 1 ? "1 Mitglied" : `${team.member_count} Mitglieder`}
                                                    </p>
                                                </div>
                                                <RoleIcon className={`w-4 h-4 ${roleColor}`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Team Details */}
                <Card className="lg:col-span-2">
                    {selectedTeam ? (
                        <>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{selectedTeam.name}</CardTitle>
                                        <CardDescription>
                                            {selectedTeam.description || "Keine Beschreibung"}
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(selectedTeam.my_role === "owner" || selectedTeam.my_role === "admin") && (
                                                <>
                                                    <DropdownMenuItem>
                                                        <Settings className="w-4 h-4 mr-2" />
                                                        Einstellungen
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setAddMemberDialogOpen(true)}>
                                                        <UserPlus className="w-4 h-4 mr-2" />
                                                        Mitglied hinzufügen
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            )}
                                            {selectedTeam.my_role === "owner" ? (
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setDeleteDialogOpen(true)}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Team löschen
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setLeaveDialogOpen(true)}
                                                >
                                                    <LogOut className="w-4 h-4 mr-2" />
                                                    Team verlassen
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Tabs value={activeTab} onValueChange={setActiveTab}>
                                    <TabsList className="grid w-full grid-cols-3 mb-4">
                                        <TabsTrigger value="members" className="flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Mitglieder
                                        </TabsTrigger>
                                        <TabsTrigger value="documents" className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Dokumente
                                        </TabsTrigger>
                                        <TabsTrigger value="templates" className="flex items-center gap-2">
                                            <LayoutTemplate className="w-4 h-4" />
                                            Vorlagen
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Members Tab */}
                                    <TabsContent value="members" className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-semibold">
                                                {members?.length || 0} Mitglieder
                                            </h3>
                                            {(selectedTeam.my_role === "owner" || selectedTeam.my_role === "admin") && (
                                                <Button size="sm" onClick={() => setAddMemberDialogOpen(true)}>
                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                    Hinzufügen
                                                </Button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {members?.map((member) => {
                                                const role = roleInfo[member.role] || roleInfo.member;
                                                const RoleIcon = role.icon;

                                                return (
                                                    <div
                                                        key={member.id}
                                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                                                {member.user_id.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm">{member.user_id}</p>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <RoleIcon className={`w-3 h-3 ${role.color}`} />
                                                                    {role.label}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {(selectedTeam.my_role === "owner" || selectedTeam.my_role === "admin") &&
                                                            member.role !== "owner" && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRemoveMember(member)}
                                                                    disabled={removeMemberMutation.isPending}
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                </Button>
                                                            )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </TabsContent>

                                    {/* Documents Tab */}
                                    <TabsContent value="documents" className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-semibold">
                                                {shares?.length || 0} Geteilte Dokumente
                                            </h3>
                                        </div>
                                        {shares?.length === 0 ? (
                                            <div className="text-center py-8 bg-muted/30 rounded-lg">
                                                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                                                <p className="text-sm font-medium mb-1">Noch keine geteilten Dokumente</p>
                                                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                                    Teile Dokumente aus dem Repository mit diesem Team.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {shares?.map((share) => (
                                                    <div
                                                        key={share.id}
                                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="w-5 h-5 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-sm font-medium">
                                                                    {share.document_id
                                                                        ? `Dokument #${share.document_id}`
                                                                        : `Entwurf #${share.draft_id}`}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Geteilt von {share.shared_by}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {share.can_view && <Eye className="w-3 h-3" />}
                                                            {share.can_edit && <span>Bearbeiten</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TabsContent>

                                    {/* Templates Tab */}
                                    <TabsContent value="templates" className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-semibold">
                                                {templates?.length || 0} Vorlagen
                                            </h3>
                                            {(selectedTeam.my_role === "owner" || selectedTeam.my_role === "admin") && (
                                                <Button size="sm" onClick={() => setCreateTemplateDialogOpen(true)}>
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Neue Vorlage
                                                </Button>
                                            )}
                                        </div>
                                        {templates?.length === 0 ? (
                                            <div className="text-center py-8 bg-muted/30 rounded-lg">
                                                <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                                                <p className="text-sm font-medium mb-1">Noch keine Team-Vorlagen</p>
                                                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                                    Erstelle Vorlagen, die nur für dieses Team sichtbar sind.
                                                </p>
                                                {(selectedTeam.my_role === "owner" || selectedTeam.my_role === "admin") && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-4"
                                                        onClick={() => setCreateTemplateDialogOpen(true)}
                                                    >
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Erste Vorlage erstellen
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {templates?.map((template) => (
                                                    <div
                                                        key={template.id}
                                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                                template.is_own_template
                                                                    ? 'bg-primary/20 text-primary'
                                                                    : template.visibility === 'global'
                                                                    ? 'bg-blue-100 text-blue-600'
                                                                    : 'bg-orange-100 text-orange-600'
                                                            }`}>
                                                                {template.visibility === 'global' ? (
                                                                    <Globe className="w-5 h-5" />
                                                                ) : template.is_own_template ? (
                                                                    <LayoutTemplate className="w-5 h-5" />
                                                                ) : (
                                                                    <Share2 className="w-5 h-5" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium">{template.name}</p>
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                    {template.category && (
                                                                        <span className="bg-muted px-1.5 py-0.5 rounded">
                                                                            {template.category}
                                                                        </span>
                                                                    )}
                                                                    {template.is_own_template ? (
                                                                        <span className="text-primary">Team-Vorlage</span>
                                                                    ) : template.visibility === 'global' ? (
                                                                        <span className="text-blue-600">Global</span>
                                                                    ) : (
                                                                        <span className="text-orange-600">Geteilt</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {template.can_duplicate && (
                                                                <Button variant="ghost" size="icon" title="Kopieren">
                                                                    <Copy className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {template.can_use && (
                                                                <Button variant="outline" size="sm">
                                                                    Verwenden
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <Users className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium mb-1">Team auswählen</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    Wähle ein Team aus der Liste, um Details und Mitglieder anzuzeigen.
                                </p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>

            {/* Create Team Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neues Team erstellen</DialogTitle>
                        <DialogDescription>
                            Erstelle ein Team, um Dokumente mit Kollegen zu teilen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="teamName">Team-Name</Label>
                            <Input
                                id="teamName"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="z.B. HR-Team Deutschland"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="teamDescription">Beschreibung (optional)</Label>
                            <Input
                                id="teamDescription"
                                value={newTeamDescription}
                                onChange={(e) => setNewTeamDescription(e.target.value)}
                                placeholder="Kurze Beschreibung des Teams"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleCreateTeam}
                            disabled={!newTeamName.trim() || createTeamMutation.isPending}
                        >
                            {createTeamMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Team erstellen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mitglied hinzufügen</DialogTitle>
                        <DialogDescription>
                            Füge einen Benutzer zum Team "{selectedTeam?.name}" hinzu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="memberId">Benutzer-ID / E-Mail</Label>
                            <Input
                                id="memberId"
                                value={newMemberId}
                                onChange={(e) => setNewMemberId(e.target.value)}
                                placeholder="z.B. max.mustermann@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="memberRole">Rolle</Label>
                            <select
                                id="memberRole"
                                value={newMemberRole}
                                onChange={(e) => setNewMemberRole(e.target.value)}
                                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                            >
                                <option value="member">Mitglied - Kann Dokumente teilen</option>
                                <option value="viewer">Betrachter - Nur Ansicht</option>
                                {(selectedTeam?.my_role === "owner") && (
                                    <option value="admin">Administrator - Kann Team verwalten</option>
                                )}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleAddMember}
                            disabled={!newMemberId.trim() || addMemberMutation.isPending}
                        >
                            {addMemberMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <UserPlus className="w-4 h-4 mr-2" />
                            )}
                            Hinzufügen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Leave Team Dialog */}
            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Team verlassen?</DialogTitle>
                        <DialogDescription>
                            Bist du sicher, dass du das Team "{selectedTeam?.name}" verlassen möchtest?
                            Du verlierst den Zugriff auf alle geteilten Dokumente dieses Teams.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleLeaveTeam}
                            disabled={removeMemberMutation.isPending}
                        >
                            {removeMemberMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <LogOut className="w-4 h-4 mr-2" />
                            )}
                            Team verlassen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Template Dialog */}
            <Dialog open={createTemplateDialogOpen} onOpenChange={setCreateTemplateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neue Team-Vorlage erstellen</DialogTitle>
                        <DialogDescription>
                            Erstelle eine Vorlage, die nur für Mitglieder dieses Teams sichtbar ist.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="templateName">Vorlagen-Name</Label>
                            <Input
                                id="templateName"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="z.B. Arbeitsvertrag IT-Abteilung"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateDescription">Beschreibung (optional)</Label>
                            <Input
                                id="templateDescription"
                                value={newTemplateDescription}
                                onChange={(e) => setNewTemplateDescription(e.target.value)}
                                placeholder="Kurze Beschreibung der Vorlage"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateTemplateDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleCreateTemplate}
                            disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                        >
                            {createTemplateMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Erstellen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Team Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Team löschen?</DialogTitle>
                        <DialogDescription>
                            Bist du sicher, dass du das Team "{selectedTeam?.name}" löschen möchtest?
                            Alle Mitgliedschaften und geteilten Dokumente werden entfernt.
                            Diese Aktion kann nicht rückgängig gemacht werden.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteTeam}
                            disabled={deleteTeamMutation.isPending}
                        >
                            {deleteTeamMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Team löschen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
