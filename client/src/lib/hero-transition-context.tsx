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

// Animation duration as specified
const DURATION = 0.8;
const EASING = [0.32, 0.72, 0, 1];

export function HeroTransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionComplete, setTransitionComplete] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"waiting" | "expanding" | "fading" | "done">("done");
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
      pollIntervalRef.current = window.setInterval(checkForTarget, 30);

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
  
  // Calculate the target height - card should expand to cover up to the title position
  // The title is positioned after the header and ClassNavigator
  // We want the card to stop at the bottom edge of where the title will be
  const targetHeight = targetRect ? targetRect.bottom + 8 : 120;

  return (
    <HeroTransitionContext.Provider value={{ startTransition, registerTarget, isTransitioning, transitionComplete }}>
      {children}
      
      <AnimatePresence onExitComplete={handleAnimationComplete}>
        {showOverlay && transitionData && sourceRect && (
          <>
            {/* Expanding card - engulfs the page up to the title position */}
            <motion.div
              key="card-expand"
              className="fixed z-[9998] bg-card rounded-md shadow-xl overflow-hidden"
              style={{ 
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "hsl(var(--border))",
              }}
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
                height: targetHeight,
                opacity: animationPhase === "fading" ? 0 : 1,
                borderRadius: 0,
              }}
              transition={{ 
                duration: DURATION, 
                ease: EASING,
                opacity: { duration: 0.25, ease: "easeOut" }
              }}
              onAnimationComplete={() => {
                if (animationPhase === "expanding") {
                  setAnimationPhase("fading");
                } else if (animationPhase === "fading") {
                  handleAnimationComplete();
                }
              }}
            >
              {/* Card content that fades quickly - everything except title */}
              <motion.div
                className="absolute inset-0 p-4 flex flex-col gap-2"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: DURATION * 0.3, ease: "easeOut" }}
              >
                {/* Placeholder for card details that fade out */}
                <div className="h-4 w-24 bg-muted/50 rounded mt-6" />
                <div className="h-3 w-32 bg-muted/30 rounded" />
                <div className="h-3 w-20 bg-muted/30 rounded" />
              </motion.div>
            </motion.div>
            
            {/* Floating title - transitions from card to page title position */}
            <motion.div
              key="title-float"
              className="fixed z-[9999] pointer-events-none"
              initial={{
                top: sourceRect.top + 12,
                left: sourceRect.left + 16,
                opacity: 1,
              }}
              animate={targetRect ? {
                top: targetRect.top,
                left: targetRect.left,
                opacity: 1,
              } : {
                top: sourceRect.top + 12,
                left: sourceRect.left + 16,
                opacity: 1,
              }}
              transition={{ 
                duration: DURATION,
                ease: EASING,
              }}
            >
              <motion.h4 
                className="font-semibold text-foreground whitespace-nowrap"
                initial={{ 
                  fontSize: "0.875rem",
                  opacity: 1,
                }}
                animate={{ 
                  fontSize: transitionData.entityType === "stream" ? "1.25rem" : "1.125rem",
                  opacity: targetRect ? 0 : 1,
                }}
                transition={{ 
                  fontSize: { duration: DURATION, ease: EASING },
                  opacity: { duration: 0.15, delay: DURATION * 0.85 }
                }}
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
