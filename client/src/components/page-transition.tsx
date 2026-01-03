import { useEffect, useState, useRef } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
}

interface Ball {
  id: number;
  x: number;
  delay: number;
  color: string;
}

const ballColors = [
  "hsl(181, 80%, 30%)",
  "hsl(348, 51%, 51%)",
  "hsl(45, 93%, 47%)",
  "hsl(217, 91%, 55%)",
  "hsl(280, 60%, 55%)",
];

function generateBalls(count: number): Ball[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 80 + 10,
    delay: Math.random() * 0.3,
    color: ballColors[i % ballColors.length],
  }));
}

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const [showBalls, setShowBalls] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);
  const prevKeyRef = useRef(transitionKey);
  const [contentVisible, setContentVisible] = useState(true);

  useEffect(() => {
    if (transitionKey !== prevKeyRef.current) {
      const prefersReducedMotion = 
        typeof window !== "undefined" && 
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReducedMotion) {
        setBalls(generateBalls(8));
        setShowBalls(true);
        setContentVisible(false);

        const fadeInTimer = setTimeout(() => {
          setContentVisible(true);
        }, 100);

        const hideTimer = setTimeout(() => {
          setShowBalls(false);
          prevKeyRef.current = transitionKey;
        }, 800);

        return () => {
          clearTimeout(fadeInTimer);
          clearTimeout(hideTimer);
        };
      }
      prevKeyRef.current = transitionKey;
    }
  }, [transitionKey]);

  return (
    <div className="relative w-full h-full">
      <div 
        className={`w-full h-full transition-opacity duration-200 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {children}
      </div>

      {showBalls && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {balls.map((ball) => (
            <div
              key={ball.id}
              className="absolute w-4 h-4 rounded-full animate-bounce-fall"
              style={{
                left: `${ball.x}%`,
                backgroundColor: ball.color,
                animationDelay: `${ball.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
