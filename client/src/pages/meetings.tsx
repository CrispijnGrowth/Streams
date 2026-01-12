import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AtSign,
  Search,
  Users,
  Calendar,
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Circle,
  FileText,
  Layers,
  Zap,
  CheckSquare,
  X,
  ChevronRight,
} from "lucide-react";
import type {
  Stakeholder,
  TaggedItem,
  MeetingWithItems,
  StakeholderTag,
} from "@shared/schema";
import { format } from "date-fns";

const entityTypeIcons: Record<string, typeof FileText> = {
  stream: Layers,
  solution: FileText,
  action: Zap,
  step: CheckSquare,
};

const entityTypeLabels: Record<string, string> = {
  stream: "Stream",
  solution: "Solution",
  action: "Action",
  step: "Step",
};

export function MeetingsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithItems | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<MeetingWithItems | null>(null);
  const [editingItemNotes, setEditingItemNotes] = useState<{ id: string; notes: string } | null>(null);

  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/stakeholders"],
  });

  const { data: taggedItems = [], isLoading: loadingItems } = useQuery<TaggedItem[]>({
    queryKey: ["/api/stakeholders", selectedStakeholder?.id, "items"],
    enabled: !!selectedStakeholder,
  });

  const { data: meetings = [], isLoading: loadingMeetings } = useQuery<MeetingWithItems[]>({
    queryKey: ["/api/meetings"],
  });

  const filteredStakeholders = stakeholders.filter((s) => {
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; stakeholderIds: string[]; tagIds: string[] }) => {
      const meetingRes = await apiRequest("POST", "/api/meetings", {
        title: data.title,
        scheduledAt: data.date,
        stakeholderIds: data.stakeholderIds,
      });
      const meeting = await meetingRes.json();

      for (const tagId of data.tagIds) {
        const tag = taggedItems.find((t) => t.tag.id === tagId);
        if (tag) {
          await apiRequest("POST", `/api/meetings/${meeting.id}/items`, {
            stakeholderId: tag.tag.stakeholderId,
            entityType: tag.entityType,
            entityId: tag.entityId,
          });
        }
      }
      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders", selectedStakeholder?.id, "items"] });
      setIsCreateMeetingOpen(false);
      setNewMeetingTitle("");
      setSelectedTagIds(new Set());
      toast({ title: "Meeting created" });
    },
    onError: () => {
      toast({ title: "Failed to create meeting", variant: "destructive" });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; date: string }) => {
      const res = await apiRequest("PATCH", `/api/meetings/${data.id}`, {
        title: data.title,
        scheduledAt: data.date,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setEditingMeeting(null);
      toast({ title: "Meeting updated" });
    },
    onError: () => {
      toast({ title: "Failed to update meeting", variant: "destructive" });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setViewingMeeting(null);
      toast({ title: "Meeting deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete meeting", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: string; discussionNotes?: string; isResolved?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/meeting-items/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setEditingItemNotes(null);
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/meeting-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders", selectedStakeholder?.id, "items"] });
      toast({ title: "Tag removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove tag", variant: "destructive" });
    },
  });

  const untagAllMutation = useMutation({
    mutationFn: async (stakeholderId: string) => {
      await apiRequest("DELETE", `/api/stakeholders/${stakeholderId}/tags`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stakeholders", selectedStakeholder?.id, "items"] });
      toast({ title: "All tags removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove tags", variant: "destructive" });
    },
  });

  const handleToggleTag = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setSelectedTagIds(next);
  };

  const handleSelectAll = () => {
    if (selectedTagIds.size === taggedItems.length) {
      setSelectedTagIds(new Set());
    } else {
      setSelectedTagIds(new Set(taggedItems.map((t) => t.tag.id)));
    }
  };

  const handleCreateMeeting = () => {
    if (!newMeetingTitle.trim() || selectedTagIds.size === 0 || !selectedStakeholder) return;
    createMeetingMutation.mutate({
      title: newMeetingTitle,
      date: newMeetingDate,
      stakeholderIds: [selectedStakeholder.id],
      tagIds: Array.from(selectedTagIds),
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-meetings-title">Meetings</h1>
          <p className="text-muted-foreground text-sm">
            Manage stakeholder discussion items and track meeting notes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Stakeholders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stakeholders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-stakeholders"
                />
              </div>

              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredStakeholders.map((stakeholder) => (
                  <button
                    key={stakeholder.id}
                    onClick={() => {
                      setSelectedStakeholder(stakeholder);
                      setSelectedTagIds(new Set());
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      selectedStakeholder?.id === stakeholder.id
                        ? "bg-primary text-primary-foreground"
                        : "hover-elevate"
                    }`}
                    data-testid={`button-stakeholder-${stakeholder.id}`}
                  >
                    <AtSign className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {stakeholder.firstName} {stakeholder.lastName}
                    </span>
                  </button>
                ))}

                {filteredStakeholders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? "No matches found" : "No stakeholders yet. Tag stakeholders in your streams, solutions, actions, or steps."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Tagged Items
                </CardTitle>
                {selectedStakeholder && taggedItems.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      data-testid="button-select-all-tags"
                    >
                      {selectedTagIds.size === taggedItems.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                )}
              </div>
              {selectedStakeholder && (
                <CardDescription>
                  Items tagged for {selectedStakeholder.firstName} {selectedStakeholder.lastName}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!selectedStakeholder ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a stakeholder to view their tagged items
                </p>
              ) : loadingItems ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : taggedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No items tagged for this stakeholder
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {taggedItems.map((item) => {
                    const Icon = entityTypeIcons[item.entityType] || FileText;
                    const isSelected = selectedTagIds.has(item.tag.id);

                    return (
                      <div
                        key={item.tag.id}
                        className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleTag(item.tag.id)}
                          data-testid={`checkbox-tag-${item.tag.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0 text-xs">
                              <Icon className="h-3 w-3 mr-1" />
                              {entityTypeLabels[item.entityType]}
                            </Badge>
                          </div>
                          <p className="font-medium mt-1 truncate">{item.entityName}</p>
                          {item.parentName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.grandparentName && `${item.grandparentName} → `}
                              {item.parentName}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() => deleteTagMutation.mutate(item.tag.id)}
                          data-testid={`button-untag-${item.tag.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            {selectedStakeholder && taggedItems.length > 0 && (
              <CardFooter className="flex gap-2 pt-0">
                <Button
                  className="flex-1"
                  onClick={() => setIsCreateMeetingOpen(true)}
                  disabled={selectedTagIds.size === 0}
                  data-testid="button-create-meeting"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Meeting ({selectedTagIds.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => untagAllMutation.mutate(selectedStakeholder.id)}
                  data-testid="button-untag-all"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Untag All
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Past Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMeetings ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No meetings yet. Select tagged items and create a meeting to get started.
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      onClick={() => setViewingMeeting(meeting)}
                      className="w-full text-left p-3 rounded-md border hover-elevate"
                      data-testid={`button-meeting-${meeting.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{meeting.title}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {meeting.scheduledAt
                          ? format(new Date(meeting.scheduledAt), "MMM d, yyyy")
                          : "No date"}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {meeting.items.length} item{meeting.items.length !== 1 && "s"}
                        {meeting.items.filter((i) => i.isResolved).length > 0 && (
                          <span className="text-green-600">
                            ({meeting.items.filter((i) => i.isResolved).length} resolved)
                          </span>
                        )}
                      </div>
                      {meeting.stakeholderNames.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {meeting.stakeholderNames.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              <AtSign className="h-2 w-2 mr-1" />
                              {name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isCreateMeetingOpen} onOpenChange={setIsCreateMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Meeting</DialogTitle>
            <DialogDescription>
              Create a meeting with {selectedTagIds.size} selected items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                placeholder="Enter meeting title..."
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                data-testid="input-meeting-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
                data-testid="input-meeting-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateMeetingOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMeeting}
              disabled={!newMeetingTitle.trim() || createMeetingMutation.isPending}
              data-testid="button-confirm-create-meeting"
            >
              Create Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMeeting} onOpenChange={(open) => !open && setEditingMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
          </DialogHeader>
          {editingMeeting && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Meeting Title</Label>
                <Input
                  id="edit-title"
                  value={editingMeeting.title}
                  onChange={(e) =>
                    setEditingMeeting({ ...editingMeeting, title: e.target.value })
                  }
                  data-testid="input-edit-meeting-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={
                    editingMeeting.scheduledAt
                      ? format(new Date(editingMeeting.scheduledAt), "yyyy-MM-dd")
                      : ""
                  }
                  onChange={(e) =>
                    setEditingMeeting({ ...editingMeeting, scheduledAt: e.target.value })
                  }
                  data-testid="input-edit-meeting-date"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMeeting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingMeeting) {
                  updateMeetingMutation.mutate({
                    id: editingMeeting.id,
                    title: editingMeeting.title,
                    date: editingMeeting.scheduledAt || "",
                  });
                }
              }}
              disabled={updateMeetingMutation.isPending}
              data-testid="button-confirm-edit-meeting"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingMeeting} onOpenChange={(open) => !open && setViewingMeeting(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{viewingMeeting?.title}</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (viewingMeeting) {
                      setEditingMeeting(viewingMeeting);
                      setViewingMeeting(null);
                    }
                  }}
                  data-testid="button-edit-meeting"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (viewingMeeting) {
                      deleteMeetingMutation.mutate(viewingMeeting.id);
                    }
                  }}
                  data-testid="button-delete-meeting"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {viewingMeeting?.scheduledAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(viewingMeeting.scheduledAt), "MMMM d, yyyy")}
              </div>
            )}
            {viewingMeeting?.stakeholderNames && viewingMeeting.stakeholderNames.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {viewingMeeting.stakeholderNames.map((name, i) => (
                  <Badge key={i} variant="secondary">
                    <AtSign className="h-3 w-3 mr-1" />
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>

          <Separator />

          <div className="space-y-4 py-2">
            <h4 className="font-medium">Discussion Items</h4>
            {viewingMeeting?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items in this meeting</p>
            ) : (
              <div className="space-y-3">
                {viewingMeeting?.items.map((item) => {
                  const Icon = entityTypeIcons[item.entityType] || FileText;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-md border ${
                        item.isResolved ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            updateItemMutation.mutate({
                              id: item.id,
                              isResolved: !item.isResolved,
                            })
                          }
                          className="mt-0.5"
                          data-testid={`button-toggle-resolved-${item.id}`}
                        >
                          {item.isResolved ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              <Icon className="h-3 w-3 mr-1" />
                              {entityTypeLabels[item.entityType]}
                            </Badge>
                            <span className="font-medium">{item.entityName}</span>
                          </div>
                          {item.parentName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.parentName}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <AtSign className="h-3 w-3" />
                            {item.stakeholderName}
                          </div>

                          {editingItemNotes?.id === item.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editingItemNotes.notes}
                                onChange={(e) =>
                                  setEditingItemNotes({
                                    ...editingItemNotes,
                                    notes: e.target.value,
                                  })
                                }
                                placeholder="Add discussion notes..."
                                className="min-h-[80px]"
                                data-testid={`textarea-notes-${item.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateItemMutation.mutate({
                                      id: item.id,
                                      discussionNotes: editingItemNotes.notes,
                                    })
                                  }
                                  data-testid={`button-save-notes-${item.id}`}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingItemNotes(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : item.discussionNotes ? (
                            <div className="mt-2 text-sm bg-muted/50 p-2 rounded">
                              <p className="whitespace-pre-wrap">{item.discussionNotes}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-6 text-xs"
                                onClick={() =>
                                  setEditingItemNotes({
                                    id: item.id,
                                    notes: item.discussionNotes || "",
                                  })
                                }
                                data-testid={`button-edit-notes-${item.id}`}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit Notes
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-6 text-xs"
                              onClick={() =>
                                setEditingItemNotes({ id: item.id, notes: "" })
                              }
                              data-testid={`button-add-notes-${item.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Notes
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MeetingsPage;
