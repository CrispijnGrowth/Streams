import { useState, useRef } from "react";
import { useAuth, getSessionHeaders } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, UserPlus, Shield, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import type { User } from "@shared/schema";

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
}

export function SettingsPage() {
  const { user, updateUser, sessionId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: pendingUsers = [], isLoading: loadingPending } = useQuery<User[]>({
    queryKey: ["/api/admin/pending-users"],
    enabled: isAdmin && !!sessionId,
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
      toast({ title: "User approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve user", variant: "destructive" });
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
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
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
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Import completed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to import data", variant: "destructive" });
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
      importMutation.mutate(selectedFile);
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
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-select-file"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Excel File
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Expected columns:</p>
                <p>Streams: stream_key, stream_name, phases, owners, momentumStatus</p>
                <p>Solutions: solution_key, solution_name, stream_key, owners</p>
                <p>Deliverables: deliverable_key, deliverable_name, solution_key, milestone_date, owners</p>
                <p>Actions: action_key, action_name, deliverable_key, solution_key, status, due_date, effort, owners</p>
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

              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-md">
                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  This will create new data. Existing data will not be affected.
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
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
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
              <UserPlus className="h-5 w-5" />
              Pending Approvals
            </CardTitle>
            <CardDescription>Users waiting for access approval</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending approval requests
              </p>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div
                    key={pendingUser.id}
                    className="flex items-center justify-between gap-4 p-3 bg-muted rounded-md"
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
