import { createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 1.01,
  },
};

const pageTransition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.25,
};

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          className="w-full h-full"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
}
