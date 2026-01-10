import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TransitionData {
  sourceRect: DOMRect;
  solutionId: string;
  solutionName: string;
  displayKey: string;
}

interface HeroTransitionContextType {
  startTransition: (data: TransitionData, navigate: () => void) => void;
  registerTarget: (solutionId: string, element: HTMLElement | null) => void;
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
  const targetRegistryRef = useRef<Map<string, HTMLElement>>(new Map());
  const pendingNavigateRef = useRef<(() => void) | null>(null);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const registerTarget = useCallback((solutionId: string, element: HTMLElement | null) => {
    if (element) {
      targetRegistryRef.current.set(solutionId, element);
      
      if (transitionData?.solutionId === solutionId && isTransitioning && !targetRect) {
        requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        });
      }
    } else {
      targetRegistryRef.current.delete(solutionId);
    }
  }, [transitionData, isTransitioning, targetRect]);

  const startTransition = useCallback((data: TransitionData, navigate: () => void) => {
    if (prefersReducedMotion) {
      navigate();
      return;
    }

    setTransitionData(data);
    setIsTransitioning(true);
    setShowOverlay(true);
    setTargetRect(null);
    pendingNavigateRef.current = navigate;

    requestAnimationFrame(() => {
      navigate();
    });
  }, [prefersReducedMotion]);

  const handleAnimationComplete = useCallback(() => {
    setShowOverlay(false);
    setIsTransitioning(false);
    setTransitionData(null);
    setTargetRect(null);
    pendingNavigateRef.current = null;
  }, []);

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
    width: targetRect.width,
    height: "auto" as const,
  } : {};

  return (
    <HeroTransitionContext.Provider value={{ startTransition, registerTarget, isTransitioning }}>
      {children}
      
      <AnimatePresence>
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
                  setTimeout(handleAnimationComplete, 100);
                }
              }}
              style={{ pointerEvents: "none" }}
            >
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {transitionData.displayKey}
                </span>
                <motion.h4 
                  className="font-medium"
                  initial={{ fontSize: "0.875rem" }}
                  animate={targetRect ? { fontSize: "1.125rem" } : { fontSize: "0.875rem" }}
                  transition={{ duration: DURATION, ease: EASING }}
                >
                  {transitionData.solutionName}
                </motion.h4>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </HeroTransitionContext.Provider>
  );
}
