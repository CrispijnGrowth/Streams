import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AtSign, UserPlus, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Stakeholder } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MentionableTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  "data-testid"?: string;
}

export const MentionableTextArea = forwardRef<HTMLTextAreaElement, MentionableTextAreaProps>(
  ({ value, onChange, placeholder, className, rows = 3, disabled, "data-testid": testId }, ref) => {
    const [showMentionPopover, setShowMentionPopover] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newFirstName, setNewFirstName] = useState("");
    const [newLastName, setNewLastName] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
      queryKey: ["/api/stakeholders"],
    });

    const createStakeholderMutation = useMutation({
      mutationFn: async (data: { firstName: string; lastName: string }) => {
        const res = await apiRequest("POST", "/api/stakeholders", data);
        return res.json() as Promise<Stakeholder>;
      },
      onSuccess: (newStakeholder) => {
        queryClient.invalidateQueries({ queryKey: ["/api/stakeholders"] });
        insertMention(newStakeholder);
        setNewFirstName("");
        setNewLastName("");
        setShowCreateForm(false);
      },
    });

    const filteredStakeholders = stakeholders.filter((s) => {
      if (!mentionQuery) return true;
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      return fullName.includes(mentionQuery.toLowerCase());
    }).slice(0, 8);

    const insertMention = useCallback(
      (stakeholder: Stakeholder) => {
        if (mentionStartIndex === -1) return;

        const beforeMention = value.slice(0, mentionStartIndex);
        const afterMention = value.slice(mentionStartIndex + mentionQuery.length + 1);
        const mentionText = `@${stakeholder.firstName} ${stakeholder.lastName}`;
        
        const newValue = beforeMention + mentionText + " " + afterMention;
        onChange(newValue);
        
        setShowMentionPopover(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
        setSelectedIndex(0);
        
        setTimeout(() => {
          if (textareaRef.current) {
            const newCursorPos = beforeMention.length + mentionText.length + 1;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      },
      [value, onChange, mentionStartIndex, mentionQuery]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      onChange(newValue);

      const textBeforeCursor = newValue.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(atIndex + 1);
        const hasSpaceBeforeAt = atIndex === 0 || /\s/.test(newValue[atIndex - 1]);
        
        if (hasSpaceBeforeAt && !/\s/.test(textAfterAt.slice(-1))) {
          setMentionStartIndex(atIndex);
          setMentionQuery(textAfterAt);
          setShowMentionPopover(true);
          setSelectedIndex(0);
          
          if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect();
            const lineHeight = parseInt(getComputedStyle(textareaRef.current).lineHeight) || 20;
            const lines = textBeforeCursor.split("\n");
            const currentLineIndex = lines.length - 1;
            
            setPopoverPosition({
              top: rect.top + (currentLineIndex + 1) * lineHeight + 4,
              left: rect.left + 8,
            });
          }
          return;
        }
      }

      if (showMentionPopover && (textBeforeCursor.slice(mentionStartIndex).includes(" ") || atIndex === -1)) {
        setShowMentionPopover(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showMentionPopover) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredStakeholders.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && filteredStakeholders.length > 0) {
        e.preventDefault();
        insertMention(filteredStakeholders[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionPopover(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
      } else if (e.key === "Tab" && filteredStakeholders.length === 0 && mentionQuery.trim()) {
        e.preventDefault();
        setShowCreateForm(true);
        const parts = mentionQuery.trim().split(" ");
        setNewFirstName(parts[0] || "");
        setNewLastName(parts.slice(1).join(" ") || "");
      }
    };

    const handleCreateStakeholder = () => {
      if (newFirstName.trim() && newLastName.trim()) {
        createStakeholderMutation.mutate({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
        });
      }
    };

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          textareaRef.current &&
          !textareaRef.current.contains(e.target as Node)
        ) {
          setShowMentionPopover(false);
          setShowCreateForm(false);
        }
      };

      if (showMentionPopover) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [showMentionPopover]);

    return (
      <div className="relative">
        <Textarea
          ref={(el) => {
            textareaRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          rows={rows}
          disabled={disabled}
          data-testid={testId}
        />

        {showMentionPopover && (
          <div
            ref={popoverRef}
            className="fixed z-50 min-w-[220px] rounded-md border bg-popover p-1 shadow-md"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
          >
            {!showCreateForm ? (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AtSign className="h-3 w-3" />
                  {mentionQuery ? `Searching "${mentionQuery}"` : "Tag a stakeholder"}
                </div>
                
                {filteredStakeholders.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto">
                    {filteredStakeholders.map((stakeholder, index) => (
                      <button
                        key={stakeholder.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-sm cursor-pointer flex items-center gap-2",
                          index === selectedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        )}
                        onClick={() => insertMention(stakeholder)}
                        data-testid={`mention-option-${stakeholder.id}`}
                      >
                        <AtSign className="h-3 w-3 text-muted-foreground" />
                        {stakeholder.firstName} {stakeholder.lastName}
                      </button>
                    ))}
                  </div>
                ) : mentionQuery.trim() ? (
                  <div className="p-2 space-y-2">
                    <p className="text-sm text-muted-foreground">No stakeholders found</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowCreateForm(true);
                        const parts = mentionQuery.trim().split(" ");
                        setNewFirstName(parts[0] || "");
                        setNewLastName(parts.slice(1).join(" ") || "");
                      }}
                      data-testid="button-create-stakeholder-from-mention"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Create "{mentionQuery.trim()}"
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-2 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Create new stakeholder</p>
                <Input
                  placeholder="First name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  data-testid="input-mention-first-name"
                />
                <Input
                  placeholder="Last name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-mention-last-name"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateStakeholder}
                    disabled={!newFirstName.trim() || !newLastName.trim() || createStakeholderMutation.isPending}
                    className="flex-1"
                    data-testid="button-confirm-create-stakeholder"
                  >
                    {createStakeholderMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

MentionableTextArea.displayName = "MentionableTextArea";
