import { useRef, useCallback } from "react";

interface ResizeState {
  startX: number;
  startY: number;
  origW: number;
  origH: number;
}

const MIN_W = 200;
const MIN_H = 100;

export function useResize(
  w: number,
  h: number,
  onResize: (w: number, h: number) => void,
) {
  const resizeRef = useRef<ResizeState | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: w,
        origH: h,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const newW = Math.max(
          MIN_W,
          resizeRef.current.origW + ev.clientX - resizeRef.current.startX,
        );
        const newH = Math.max(
          MIN_H,
          resizeRef.current.origH + ev.clientY - resizeRef.current.startY,
        );
        onResize(newW, newH);
      };

      const handleUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [w, h, onResize],
  );

  return handleMouseDown;
}
