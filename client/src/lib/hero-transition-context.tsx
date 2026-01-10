import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TransitionData {
  sourceRect: DOMRect;
  entityId: string;
  entityName: string;
  displayKey: string;
  entityType: "stream" | "solution";
}

interface HeroTransitionContextType {
  startTransition: (data: TransitionData, navigate: () => void) => void;
  registerTarget: (entityId: string, element: HTMLElement | null) => void;
  isTransitioning: boolean;
}

const HeroTransitionContext = createContext<HeroTransitionContextType>({
  startTransition: () => {},
  registerTarget: () => {},
  isTransitioning: false,
});

export function useHeroTransition() {
  return useContext(HeroTransitionContext);
}

const DURATION = 0.52;
const EASING = [0.16, 1, 0.3, 1];

export function HeroTransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"waiting" | "animating" | "done">("done");
  const targetRegistryRef = useRef<Map<string, HTMLElement>>(new Map());
  const pollIntervalRef = useRef<number | null>(null);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const registerTarget = useCallback((entityId: string, element: HTMLElement | null) => {
    if (element) {
      targetRegistryRef.current.set(entityId, element);
    } else {
      targetRegistryRef.current.delete(entityId);
    }
  }, []);

  useEffect(() => {
    if (animationPhase === "waiting" && transitionData) {
      const checkForTarget = () => {
        const targetElement = targetRegistryRef.current.get(transitionData.entityId);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          setTargetRect(rect);
          setAnimationPhase("animating");
          clearPolling();
        }
      };

      checkForTarget();
      
      pollIntervalRef.current = window.setInterval(checkForTarget, 50);

      const timeout = setTimeout(() => {
        clearPolling();
        if (animationPhase === "waiting") {
          handleAnimationComplete();
        }
      }, 2000);

      return () => {
        clearTimeout(timeout);
        clearPolling();
      };
    }
  }, [animationPhase, transitionData, clearPolling]);

  const startTransition = useCallback((data: TransitionData, navigate: () => void) => {
    if (prefersReducedMotion) {
      navigate();
      return;
    }

    setTransitionData(data);
    setIsTransitioning(true);
    setShowOverlay(true);
    setTargetRect(null);
    setAnimationPhase("waiting");

    requestAnimationFrame(() => {
      navigate();
    });
  }, [prefersReducedMotion]);

  const handleAnimationComplete = useCallback(() => {
    clearPolling();
    setShowOverlay(false);
    setIsTransitioning(false);
    setTransitionData(null);
    setTargetRect(null);
    setAnimationPhase("done");
  }, [clearPolling]);

  const sourceStyle = transitionData?.sourceRect ? {
    position: "fixed" as const,
    top: transitionData.sourceRect.top,
    left: transitionData.sourceRect.left,
    width: transitionData.sourceRect.width,
    height: transitionData.sourceRect.height,
  } : {};

  const targetStyle = targetRect ? {
    position: "fixed" as const,
    top: targetRect.top,
    left: targetRect.left,
    width: "auto" as const,
    height: "auto" as const,
  } : {};

  return (
    <HeroTransitionContext.Provider value={{ startTransition, registerTarget, isTransitioning }}>
      {children}
      
      <AnimatePresence onExitComplete={handleAnimationComplete}>
        {showOverlay && transitionData && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 bg-background z-[9998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION * 0.6, ease: EASING }}
            />
            
            <motion.div
              key="hero-card"
              className="z-[9999] bg-card border rounded-md shadow-lg p-4 overflow-hidden"
              initial={sourceStyle}
              animate={targetRect ? targetStyle : sourceStyle}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: DURATION, 
                ease: EASING,
              }}
              onAnimationComplete={() => {
                if (targetRect) {
                  setTimeout(handleAnimationComplete, 80);
                }
              }}
              style={{ pointerEvents: "none" }}
            >
              <div className="space-y-1">
                {transitionData.displayKey && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {transitionData.displayKey}
                  </span>
                )}
                <motion.h4 
                  className="font-medium whitespace-nowrap"
                  initial={{ fontSize: transitionData.entityType === "stream" ? "0.875rem" : "0.875rem" }}
                  animate={targetRect ? { fontSize: "1.125rem" } : { fontSize: "0.875rem" }}
                  transition={{ duration: DURATION, ease: EASING }}
                >
                  {transitionData.entityName}
                </motion.h4>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </HeroTransitionContext.Provider>
  );
}
