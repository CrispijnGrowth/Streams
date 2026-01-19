import { useState, useRef } from "react";
import { useAuth, getSessionHeaders } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, UserPlus, Shield, Upload, FileSpreadsheet, AlertCircle, Users, Plus, Trash2, Pencil, X, Download, Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { User, TeamMember } from "@shared/schema";

interface ImportPreview {
  [sheetName: string]: {
    headers: string[];
    rowCount: number;
    sample: any[];
  };
}

interface ImportStats {
  streams: number;
  solutions: number;
  deliverables: number;
  actions: number;
  steps: number;
  streamsUpdated?: number;
  solutionsUpdated?: number;
  deliverablesUpdated?: number;
  actionsUpdated?: number;
}

export function SettingsPage() {
  const { user, updateUser, sessionId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [updateMode, setUpdateMode] = useState(false);
  
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberPhotoData, setNewMemberPhotoData] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";

  const { data: pendingUsers = [], isLoading: loadingPending } = useQuery<User[]>({
    queryKey: ["/api/admin/pending-users"],
    enabled: isAdmin && !!sessionId,
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin && !!sessionId,
  });
  
  const { data: teamMembers = [], isLoading: loadingTeamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: !!sessionId,
  });

  const preferenceMutation = useMutation({
    mutationFn: async (prefs: { showDescriptions?: boolean; themePreference?: string }) => {
      const res = await fetch("/api/auth/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getSessionHeaders() },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/approve/${userId}`, {
        method: "POST",
        headers: getSessionHeaders(),
      });
      if (!res.ok) throw new Error("Failed to approve user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve user", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "member" }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getSessionHeaders() },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: (_, { role }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: role === "admin" ? "User promoted to admin" : "Admin role removed" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: "POST",
        headers: getSessionHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User removed" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: getSessionHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to parse file");
      return res.json();
    },
    onSuccess: (data) => {
      setImportPreview(data.preview);
      setImportStats(null);
    },
    onError: () => {
      toast({ title: "Failed to parse Excel file", variant: "destructive" });
      setSelectedFile(null);
      setImportPreview(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, updateMode }: { file: File; updateMode: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateMode", String(updateMode));
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: getSessionHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to import data");
      return res.json();
    },
    onSuccess: (data) => {
      setImportStats(data.stats);
      setImportPreview(null);
      setSelectedFile(null);
      setUpdateMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      const mode = data.updateMode ? "update" : "import";
      toast({ title: `Data ${mode} completed successfully` });
    },
    onError: () => {
      toast({ title: "Failed to import data", variant: "destructive" });
    },
  });
  
  const createMemberMutation = useMutation({
    mutationFn: async (data: { name: string; role?: string; photoData?: string }) => {
      return apiRequest("POST", "/api/team-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setIsAddingMember(false);
      setNewMemberName("");
      setNewMemberRole("");
      setNewMemberPhotoData("");
      toast({ title: "Team member added" });
    },
    onError: () => {
      toast({ title: "Failed to add team member", variant: "destructive" });
    },
  });
  
  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; role?: string; photoData?: string } }) => {
      return apiRequest("PATCH", `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setEditingMember(null);
      toast({ title: "Team member updated" });
    },
    onError: () => {
      toast({ title: "Failed to update team member", variant: "destructive" });
    },
  });
  
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove team member", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStats(null);
      previewMutation.mutate(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate({ file: selectedFile, updateMode });
    }
  };

  const clearImport = () => {
    setSelectedFile(null);
    setImportPreview(null);
    setImportStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    createMemberMutation.mutate({
      name: newMemberName.trim(),
      role: newMemberRole.trim() || undefined,
      photoData: newMemberPhotoData || undefined,
    });
  };
  
  const handleUpdateMember = () => {
    if (!editingMember || !newMemberName.trim()) return;
    updateMemberMutation.mutate({
      id: editingMember.id,
      data: {
        name: newMemberName.trim(),
        role: newMemberRole.trim() || undefined,
        photoData: newMemberPhotoData || undefined,
      },
    });
  };
  
  const startEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setNewMemberName(member.name);
    setNewMemberRole(member.role || "");
    setNewMemberPhotoData(member.photoData || member.photoUrl || "");
    setIsAddingMember(false);
  };
  
  const cancelMemberEdit = () => {
    setEditingMember(null);
    setIsAddingMember(false);
    setNewMemberName("");
    setNewMemberRole("");
    setNewMemberPhotoData("");
  };
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, inputRef: React.RefObject<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      
      const res = await fetch("/api/upload/team-photo", {
        method: "POST",
        headers: getSessionHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }
      const { photoData } = await res.json();
      setNewMemberPhotoData(photoData);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to upload photo", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{user.name}</p>
            </div>
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role === "admin" ? (
                <>
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </>
              ) : (
                "Member"
              )}
            </Badge>
          </div>
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="show-descriptions">Show Descriptions</Label>
              <p className="text-sm text-muted-foreground">
                Display item descriptions in list views
              </p>
            </div>
            <Switch
              id="show-descriptions"
              checked={user.showDescriptions}
              onCheckedChange={(checked) => preferenceMutation.mutate({ showDescriptions: checked })}
              disabled={preferenceMutation.isPending}
              data-testid="switch-descriptions"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <Select
              value={user.themePreference}
              onValueChange={(value) => preferenceMutation.mutate({ themePreference: value })}
              disabled={preferenceMutation.isPending}
            >
              <SelectTrigger className="w-32" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </CardTitle>
          <CardDescription>
            Speed up your workflow with keyboard shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-shortcuts">
                <Keyboard className="h-4 w-4 mr-2" />
                View Shortcuts
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Navigation & Actions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Add new item</span>
                      <Badge variant="secondary" className="font-mono">N</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Edit selected item</span>
                      <Badge variant="secondary" className="font-mono">E</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Archive selected item</span>
                      <Badge variant="secondary" className="font-mono">A</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Delete selected item</span>
                      <Badge variant="secondary" className="font-mono">Delete</Badge>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Shortcuts are disabled when typing in text fields.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Manage team members who can be assigned as owners
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTeamMembers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {teamMembers.length === 0 && !isAddingMember && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No team members yet. Add your first team member below.
                </p>
              )}
              
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  editingMember?.id === member.id ? (
                    <div key={member.id} className="p-3 bg-muted rounded-md space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {newMemberPhotoData ? (
                            <AvatarImage src={newMemberPhotoData} alt={newMemberName} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(newMemberName || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            placeholder="Name"
                            data-testid="input-edit-member-name"
                          />
                          <Input
                            value={newMemberRole}
                            onChange={(e) => setNewMemberRole(e.target.value)}
                            placeholder="Role (e.g. Developer)"
                            data-testid="input-edit-member-role"
                          />
                          <input
                            ref={editPhotoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, editPhotoInputRef)}
                            className="hidden"
                            data-testid="input-edit-member-photo-file"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editPhotoInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            data-testid="button-edit-member-photo"
                          >
                            {isUploadingPhoto ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {newMemberPhotoData ? "Change Photo" : "Upload Photo"}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateMember}
                          disabled={updateMemberMutation.isPending || !newMemberName.trim()}
                          data-testid="button-save-member"
                        >
                          {updateMemberMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelMemberEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 p-3 bg-muted rounded-md"
                      data-testid={`team-member-${member.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {(member.photoData || member.photoUrl) ? (
                            <AvatarImage src={member.photoData || member.photoUrl || ""} alt={member.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          {member.role && (
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditMember(member)}
                          data-testid={`button-edit-member-${member.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMemberMutation.mutate(member.id)}
                          disabled={deleteMemberMutation.isPending}
                          data-testid={`button-delete-member-${member.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                ))}
              </div>
              
              {isAddingMember ? (
                <div className="p-3 border rounded-md space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {newMemberPhotoData ? (
                        <AvatarImage src={newMemberPhotoData} alt={newMemberName} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {newMemberName ? getInitials(newMemberName) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Name"
                        autoFocus
                        data-testid="input-new-member-name"
                      />
                      <Input
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        placeholder="Role (e.g. Developer)"
                        data-testid="input-new-member-role"
                      />
                      <input
                        ref={addPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, addPhotoInputRef)}
                        className="hidden"
                        data-testid="input-new-member-photo-file"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addPhotoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        data-testid="button-new-member-photo"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {newMemberPhotoData ? "Change Photo" : "Upload Photo"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddMember}
                      disabled={createMemberMutation.isPending || !newMemberName.trim()}
                      data-testid="button-add-member"
                    >
                      {createMemberMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelMemberEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    cancelMemberEdit();
                    setIsAddingMember(true);
                  }}
                  className="w-full"
                  data-testid="button-show-add-member"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Import streams, solutions, deliverables, actions, and steps from an Excel file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-import-file"
          />
          
          {!selectedFile && !importStats && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel file with sheets: Streams, Solutions, Deliverables, Actions, Steps
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-select-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Excel File
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `/api/import/template`;
                      const headers = getSessionHeaders();
                      fetch('/api/import/template', { headers })
                        .then(res => res.blob())
                        .then(blob => {
                          const url = window.URL.createObjectURL(blob);
                          link.href = url;
                          link.download = 'StreamFlow_Import_Template.xlsx';
                          link.click();
                          window.URL.revokeObjectURL(url);
                        });
                    }}
                    data-testid="button-download-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Expected columns:</p>
                <p>Streams: stream_key, stream_name, description, phases, owners, labels</p>
                <p>Solutions: solution_key, solution_name, stream_key, description, owners, labels</p>
                <p>Deliverables: deliverable_key, deliverable_name, solution_key, stream_key, description, milestone_date, owners</p>
                <p>Actions: action_key, action_name, deliverable_key, solution_key, stream_key, description, status, due_date, effort, owners</p>
                <p>Steps: step_key, step_name, action_key, is_done, due_date, owner</p>
              </div>
            </div>
          )}

          {previewMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Parsing file...</span>
            </div>
          )}

          {importPreview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{selectedFile?.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearImport}>
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {Object.entries(importPreview).map(([sheetName, data]) => (
                  <div key={sheetName} className="flex items-center justify-between gap-4 p-2 bg-muted rounded-md">
                    <span className="font-medium text-sm">{sheetName}</span>
                    <Badge variant="secondary">{data.rowCount} rows</Badge>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Switch
                    id="update-mode"
                    checked={updateMode}
                    onCheckedChange={setUpdateMode}
                    data-testid="switch-update-mode"
                  />
                  <Label htmlFor="update-mode" className="font-medium">Update Mode</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {updateMode 
                    ? "Match by name and update existing records, or create new if not found" 
                    : "Create new records only"}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-md">
                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  {updateMode 
                    ? "Existing items with matching names will be updated. New items will be created."
                    : "This will create new data. Existing data will not be affected."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  data-testid="button-execute-import"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {updateMode ? "Updating..." : "Importing..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {updateMode ? "Update Data" : "Import Data"}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={clearImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {importStats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-md">
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">Import completed successfully</span>
              </div>
              
              {/* Created stats */}
              {(importStats.streams > 0 || importStats.solutions > 0 || importStats.deliverables > 0 || importStats.actions > 0 || importStats.steps > 0) && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="text-center p-2 bg-muted rounded-md">
                      <div className="text-lg font-semibold">{importStats.streams}</div>
                      <div className="text-xs text-muted-foreground">Streams</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-md">
                      <div className="text-lg font-semibold">{importStats.solutions}</div>
                      <div className="text-xs text-muted-foreground">Solutions</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-md">
                      <div className="text-lg font-semibold">{importStats.deliverables}</div>
                      <div className="text-xs text-muted-foreground">Deliverables</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-md">
                      <div className="text-lg font-semibold">{importStats.actions}</div>
                      <div className="text-xs text-muted-foreground">Actions</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-md">
                      <div className="text-lg font-semibold">{importStats.steps}</div>
                      <div className="text-xs text-muted-foreground">Steps</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Updated stats */}
              {(importStats.streamsUpdated || importStats.solutionsUpdated || importStats.deliverablesUpdated || importStats.actionsUpdated) && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Updated</div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-blue-500/10 rounded-md">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{importStats.streamsUpdated || 0}</div>
                      <div className="text-xs text-muted-foreground">Streams</div>
                    </div>
                    <div className="text-center p-2 bg-blue-500/10 rounded-md">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{importStats.solutionsUpdated || 0}</div>
                      <div className="text-xs text-muted-foreground">Solutions</div>
                    </div>
                    <div className="text-center p-2 bg-blue-500/10 rounded-md">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{importStats.deliverablesUpdated || 0}</div>
                      <div className="text-xs text-muted-foreground">Deliverables</div>
                    </div>
                    <div className="text-center p-2 bg-blue-500/10 rounded-md">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{importStats.actionsUpdated || 0}</div>
                      <div className="text-xs text-muted-foreground">Actions</div>
                    </div>
                  </div>
                </div>
              )}
              
              <Button variant="outline" onClick={clearImport} data-testid="button-import-another">
                Import Another File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage user access and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingPending ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Pending Approvals ({pendingUsers.length})
                </h4>
                <div className="space-y-2">
                  {pendingUsers.map((pendingUser) => (
                    <div
                      key={pendingUser.id}
                      className="flex items-center justify-between gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md"
                      data-testid={`pending-user-${pendingUser.id}`}
                    >
                      <div>
                        <p className="font-medium">{pendingUser.name}</p>
                        <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(pendingUser.id)}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${pendingUser.id}`}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-3">Active Users ({allUsers.filter(u => u.role !== "pending").length})</h4>
              {loadingUsers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : allUsers.filter(u => u.role !== "pending").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active users
                </p>
              ) : (
                <div className="space-y-2">
                  {allUsers
                    .filter(u => u.role !== "pending")
                    .sort((a, b) => {
                      if (a.role === "admin" && b.role !== "admin") return -1;
                      if (a.role !== "admin" && b.role === "admin") return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((managedUser) => (
                      <div
                        key={managedUser.id}
                        className="flex items-center justify-between gap-4 p-3 bg-muted rounded-md"
                        data-testid={`user-${managedUser.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{managedUser.name}</p>
                              {managedUser.role === "admin" && (
                                <Badge variant="secondary" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                              {managedUser.id === user?.id && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{managedUser.email}</p>
                          </div>
                        </div>
                        {managedUser.id !== user?.id && (
                          <div className="flex items-center gap-2">
                            {managedUser.role === "admin" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateRoleMutation.mutate({ userId: managedUser.id, role: "member" })}
                                disabled={updateRoleMutation.isPending}
                                data-testid={`button-remove-admin-${managedUser.id}`}
                              >
                                {updateRoleMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Remove Admin"
                                )}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateRoleMutation.mutate({ userId: managedUser.id, role: "admin" })}
                                disabled={updateRoleMutation.isPending}
                                data-testid={`button-make-admin-${managedUser.id}`}
                              >
                                {updateRoleMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-1" />
                                    Make Admin
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deactivateMutation.mutate(managedUser.id)}
                              disabled={deactivateMutation.isPending}
                              data-testid={`button-remove-user-${managedUser.id}`}
                            >
                              {deactivateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
