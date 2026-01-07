import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export type UIMode = "operate" | "edit";

interface ModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isEditMode: boolean;
  isOperateMode: boolean;
  setAutoEditForEmptyState: (isEmpty: boolean) => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const STORAGE_KEY = "streams-ui-mode";

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("operate");
  const [isAutoEdit, setIsAutoEdit] = useState(false);
  const userPreferenceRef = useRef<UIMode>("operate");
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !hasHydratedRef.current) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "edit" || stored === "operate") {
        userPreferenceRef.current = stored;
        setModeState(stored);
      }
      hasHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (hasHydratedRef.current && !isAutoEdit) {
      localStorage.setItem(STORAGE_KEY, mode);
      userPreferenceRef.current = mode;
    }
  }, [mode, isAutoEdit]);

  const setMode = useCallback((newMode: UIMode) => {
    setIsAutoEdit(false);
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setIsAutoEdit(false);
    setModeState((prev) => (prev === "operate" ? "edit" : "operate"));
  }, []);

  const setAutoEditForEmptyState = useCallback((isEmpty: boolean) => {
    if (isEmpty) {
      setIsAutoEdit(true);
      setModeState("edit");
    } else {
      if (isAutoEdit) {
        setIsAutoEdit(false);
        setModeState(userPreferenceRef.current);
      }
    }
  }, [isAutoEdit]);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isEditMode: mode === "edit",
        isOperateMode: mode === "operate",
        setAutoEditForEmptyState,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
