import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description?: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export function useShortcutN(handler: ShortcutHandler, enabled = true) {
  useKeyboardShortcuts([
    { key: "n", handler, description: "Add new item", enabled },
  ]);
}

export function useShortcutE(handler: ShortcutHandler, enabled = true) {
  useKeyboardShortcuts([
    { key: "e", handler, description: "Edit selected item", enabled },
  ]);
}

export function useShortcutDelete(handler: ShortcutHandler, enabled = true) {
  useKeyboardShortcuts([
    { key: "Delete", handler, description: "Delete selected item", enabled },
    { key: "Backspace", handler, description: "Delete selected item", enabled },
  ]);
}

export function useShortcutA(handler: ShortcutHandler, enabled = true) {
  useKeyboardShortcuts([
    { key: "a", handler, description: "Archive selected item", enabled },
  ]);
}
