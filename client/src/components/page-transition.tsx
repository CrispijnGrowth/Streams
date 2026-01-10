import { createContext, useContext, useState, useLayoutEffect, useRef } from "react";
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
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

const pageTransition = {
  duration: 0.15,
  ease: "easeInOut",
};

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const [currentChildren, setCurrentChildren] = useState(children);
  const isFirstRender = useRef(true);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (transitionKey !== currentKey) {
      setCurrentKey(transitionKey);
      setCurrentChildren(children);
    }
  }, [transitionKey, children, currentKey]);

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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentKey}
          className="w-full h-full"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          {currentChildren}
        </motion.div>
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
}
