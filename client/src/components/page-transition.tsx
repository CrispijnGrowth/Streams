import { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionContextType {
  animationKey: number;
}

const PageTransitionContext = createContext<PageTransitionContextType>({ animationKey: 0 });

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

interface PageTransitionProps {
  transitionKey: string;
  renderContent: (displayKey: string) => React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.985,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 1.015,
  },
};

const pageTransition = {
  type: "tween",
  ease: [0.4, 0, 0.2, 1],
  duration: 0.2,
};

export function PageTransition({ transitionKey, renderContent }: PageTransitionProps) {
  const [displayKey, setDisplayKey] = useState(transitionKey);
  const [isAnimating, setIsAnimating] = useState(false);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (transitionKey !== displayKey && !isAnimating) {
      setIsAnimating(true);
    }
  }, [transitionKey, displayKey, isAnimating]);

  const handleExitComplete = () => {
    setDisplayKey(transitionKey);
    setIsAnimating(false);
  };

  if (prefersReducedMotion) {
    return (
      <PageTransitionContext.Provider value={{ animationKey: 0 }}>
        <div className="w-full h-full">
          {renderContent(transitionKey)}
        </div>
      </PageTransitionContext.Provider>
    );
  }

  return (
    <PageTransitionContext.Provider value={{ animationKey: 0 }}>
      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        <motion.div
          key={displayKey}
          className="w-full h-full"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          {renderContent(displayKey)}
        </motion.div>
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
}
