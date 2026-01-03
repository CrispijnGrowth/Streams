import { createContext, useContext, useEffect, useState, useRef } from "react";

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

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const prevKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (transitionKey !== prevKeyRef.current) {
      const prefersReducedMotion = 
        typeof window !== "undefined" && 
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReducedMotion) {
        setContentVisible(false);
        
        const fadeInTimer = setTimeout(() => {
          setContentVisible(true);
          setAnimationKey(prev => prev + 1);
        }, 50);

        prevKeyRef.current = transitionKey;
        return () => clearTimeout(fadeInTimer);
      }
      prevKeyRef.current = transitionKey;
    }
  }, [transitionKey]);

  return (
    <PageTransitionContext.Provider value={{ animationKey }}>
      <div 
        className={`w-full h-full transition-opacity duration-150 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {children}
      </div>
    </PageTransitionContext.Provider>
  );
}
