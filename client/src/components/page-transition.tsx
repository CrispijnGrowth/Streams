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
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 1.02,
  },
};

const pageTransition = {
  type: "tween",
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.2,
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
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={transitionKey}
            className="absolute inset-0 w-full h-full overflow-auto"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={pageTransition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransitionContext.Provider>
  );
}
