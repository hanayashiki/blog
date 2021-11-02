import { useState, useLayoutEffect } from 'preact/hooks';

const useRaf = (ms: number = 1e12, delay: number = 0): number => {
  const [elapsed, set] = useState<number>(0);

  if (typeof window !== 'undefined') {
    useLayoutEffect(() => {
      let raf: number;
      let timerStop: number | NodeJS.Timeout;
      let start: number;

      const onFrame = () => {
        const time = Math.min(1, (Date.now() - start) / ms);
        set(time);
        loop();
      };
      const loop = () => {
        raf = requestAnimationFrame(onFrame);
      };
      const onStart = () => {
        start = Date.now();
        loop();
      };
      const timerDelay = setTimeout(onStart, delay);

      return () => {
        clearTimeout(timerStop as NodeJS.Timeout);
        clearTimeout(timerDelay);
        cancelAnimationFrame(raf);
      };
    }, [ms, delay]);
  }

  return elapsed;
};

export default useRaf;
