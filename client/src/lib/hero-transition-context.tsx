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
  transitionComplete: boolean;
}

const HeroTransitionContext = createContext<HeroTransitionContextType>({
  startTransition: () => {},
  registerTarget: () => {},
  isTransitioning: false,
  transitionComplete: true,
});

export function useHeroTransition() {
  return useContext(HeroTransitionContext);
}

const DURATION = 0.6;
const EASING = [0.32, 0.72, 0, 1];

export function HeroTransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionComplete, setTransitionComplete] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"waiting" | "expanding" | "done">("done");
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
          setAnimationPhase("expanding");
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

    clearPolling();
    
    setTransitionData(data);
    setIsTransitioning(true);
    setTransitionComplete(false);
    setShowOverlay(true);
    setTargetRect(null);
    setAnimationPhase("waiting");

    requestAnimationFrame(() => {
      navigate();
    });
  }, [prefersReducedMotion, clearPolling]);

  const handleAnimationComplete = useCallback(() => {
    clearPolling();
    setShowOverlay(false);
    setIsTransitioning(false);
    setTransitionComplete(true);
    setTransitionData(null);
    setTargetRect(null);
    setAnimationPhase("done");
  }, [clearPolling]);

  const sourceRect = transitionData?.sourceRect;

  return (
    <HeroTransitionContext.Provider value={{ startTransition, registerTarget, isTransitioning, transitionComplete }}>
      {children}
      
      <AnimatePresence onExitComplete={handleAnimationComplete}>
        {showOverlay && transitionData && sourceRect && (
          <>
            <motion.div
              key="card-expand"
              className="fixed z-[9998] bg-card border border-border rounded-md shadow-xl overflow-hidden"
              initial={{
                top: sourceRect.top,
                left: sourceRect.left,
                width: sourceRect.width,
                height: sourceRect.height,
                opacity: 1,
                borderRadius: 6,
              }}
              animate={{
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                opacity: 0,
                borderRadius: 0,
              }}
              transition={{ 
                duration: DURATION, 
                ease: EASING,
                opacity: { duration: DURATION * 0.8, delay: DURATION * 0.2 }
              }}
              style={{ pointerEvents: "none" }}
            />
            
            <motion.div
              key="title-float"
              className="fixed z-[9999] pointer-events-none"
              initial={{
                top: sourceRect.top + 12,
                left: sourceRect.left + 16,
              }}
              animate={targetRect ? {
                top: targetRect.top,
                left: targetRect.left,
              } : {
                top: sourceRect.top + 12,
                left: sourceRect.left + 16,
              }}
              transition={{ 
                duration: DURATION, 
                ease: EASING,
              }}
              onAnimationComplete={() => {
                if (targetRect) {
                  setTimeout(handleAnimationComplete, 50);
                }
              }}
            >
              <motion.h4 
                className="font-semibold text-foreground whitespace-nowrap"
                initial={{ fontSize: "0.875rem" }}
                animate={{ fontSize: "1.25rem" }}
                transition={{ duration: DURATION, ease: EASING }}
              >
                {transitionData.entityName}
              </motion.h4>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </HeroTransitionContext.Provider>
  );
}
