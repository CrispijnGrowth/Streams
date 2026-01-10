import { createContext, useContext, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface PageTransitionContextType {
  animationKey: number;
}

const PageTransitionContext = createContext<PageTransitionContextType>({ animationKey: 0 });

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
}

const DURATION = 0.32;
const EASING = [0.25, 0.9, 0.3, 1];

const enterVariants = {
  initial: {
    opacity: 0,
    scale: 0.97,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
};

const exitVariants = {
  initial: {
    opacity: 1,
    scale: 1,
  },
  animate: {
    opacity: 0,
    scale: 1.03,
  },
};

interface SnapshotState {
  key: string;
  node: React.ReactNode;
}

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const [active, setActive] = useState<SnapshotState>({ key: transitionKey, node: children });
  const [exiting, setExiting] = useState<SnapshotState | null>(null);
  const prevKeyRef = useRef(transitionKey);
  const isInitialMount = useRef(true);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevKeyRef.current = transitionKey;
      return;
    }

    if (transitionKey !== prevKeyRef.current) {
      setExiting({ key: prevKeyRef.current, node: active.node });
      setActive({ key: transitionKey, node: children });
      prevKeyRef.current = transitionKey;
    }
  }, [transitionKey, children, active.node]);

  const handleExitComplete = () => {
    setExiting(null);
  };

  if (prefersReducedMotion) {
    return (
      <PageTransitionContext.Provider value={{ animationKey: 0 }}>
        <div className="w-full h-full">
          {children}
        </div>
      </PageTransitionContext.Provider>
    );
  }

  return (
    <PageTransitionContext.Provider value={{ animationKey: 0 }}>
      <div className="relative w-full h-full overflow-hidden">
        {exiting && (
          <motion.div
            key={`exit-${exiting.key}`}
            className="absolute inset-0 w-full h-full overflow-auto"
            initial="initial"
            animate="animate"
            variants={exitVariants}
            transition={{ duration: DURATION, ease: EASING }}
            onAnimationComplete={handleExitComplete}
            style={{ 
              zIndex: 1,
              transformOrigin: "center top",
              pointerEvents: "none",
              willChange: "transform, opacity",
            }}
          >
            {exiting.node}
          </motion.div>
        )}
        <motion.div
          key={`enter-${active.key}`}
          className="absolute inset-0 w-full h-full overflow-auto"
          initial={exiting ? "initial" : false}
          animate="animate"
          variants={enterVariants}
          transition={{ duration: DURATION, ease: EASING }}
          style={{ 
            zIndex: 2,
            transformOrigin: "center top",
            willChange: "transform, opacity",
          }}
        >
          {active.node}
        </motion.div>
      </div>
    </PageTransitionContext.Provider>
  );
}
