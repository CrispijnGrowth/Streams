import { useState } from "react";
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
import { Loader2, Check, UserPlus, Shield } from "lucide-react";
import type { User } from "@shared/schema";

export function SettingsPage() {
  const { user, updateUser, sessionId } = useAuth();
  const { toast } = useToast();

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
