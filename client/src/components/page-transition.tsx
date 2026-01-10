import { createContext, useContext, useState, useLayoutEffect, useRef, cloneElement, isValidElement } from "react";
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

const transitionConfig = {
  duration: 0.22,
  ease: [0.22, 0.61, 0.36, 1],
};

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const [activeKey, setActiveKey] = useState(transitionKey);
  const [activeNode, setActiveNode] = useState(children);
  const [exitingNode, setExitingNode] = useState<React.ReactNode>(null);
  const [exitingKey, setExitingKey] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setActiveKey(transitionKey);
      setActiveNode(children);
      return;
    }

    if (transitionKey !== activeKey) {
      setExitingNode(activeNode);
      setExitingKey(activeKey);
      setActiveKey(transitionKey);
      setActiveNode(children);
    }
  }, [transitionKey, children, activeKey, activeNode]);

  const handleExitComplete = () => {
    setExitingNode(null);
    setExitingKey(null);
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
        {exitingNode && exitingKey && (
          <motion.div
            key={`exit-${exitingKey}`}
            className="absolute inset-0 w-full h-full overflow-auto"
            initial="initial"
            animate="animate"
            variants={exitVariants}
            transition={transitionConfig}
            onAnimationComplete={handleExitComplete}
            style={{ zIndex: 1 }}
          >
            {exitingNode}
          </motion.div>
        )}
        <motion.div
          key={`enter-${activeKey}`}
          className="absolute inset-0 w-full h-full overflow-auto"
          initial={exitingNode ? "initial" : false}
          animate="animate"
          variants={enterVariants}
          transition={transitionConfig}
          style={{ zIndex: 2 }}
        >
          {activeNode}
        </motion.div>
      </div>
    </PageTransitionContext.Provider>
  );
}
