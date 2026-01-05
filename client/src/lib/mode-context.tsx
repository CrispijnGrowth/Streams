import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type UIMode = "operate" | "edit";

interface ModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isEditMode: boolean;
  isOperateMode: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const STORAGE_KEY = "streams-ui-mode";

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "edit" || stored === "operate") {
        return stored;
      }
    }
    return "operate";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "operate" ? "edit" : "operate"));
  }, []);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isEditMode: mode === "edit",
        isOperateMode: mode === "operate",
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
