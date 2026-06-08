"use client";

import { useEffect, useRef, useState } from "react";

type View = { x: number; y: number; z: number };

export default function Canvas({
  children,
  minZoom = 0.3,
  maxZoom = 1.6,
  initialZoom = 0.8,
}: {
  children: React.ReactNode;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 60, y: 60, z: initialZoom });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
  } | null>(null);

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startVx: view.x,
      startVy: view.y,
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  function shouldSkipDrag(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return !!el.closest(
      "[data-no-pan], input, select, button, textarea, option, a"
    );
  }

  function onMouseDown(e: React.MouseEvent) {
    if (shouldSkipDrag(e.target)) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (shouldSkipDrag(e.target)) return;
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  useEffect(() => {
    function onMove(clientX: number, clientY: number) {
      const d = dragRef.current;
      if (!d) return;
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      setView((v) => ({ ...v, x: d.startVx + dx, y: d.startVy + dy }));
    }
    function mouseMove(e: MouseEvent) {
      onMove(e.clientX, e.clientY);
    }
    function touchMove(e: TouchEvent) {
      if (!dragRef.current) return;
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    }
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", endDrag);
    window.addEventListener("touchcancel", endDrag);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setView((v) => {
        const newZ = Math.max(minZoom, Math.min(maxZoom, v.z * delta));
        const k = newZ / v.z;
        return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z: newZ };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [minZoom, maxZoom]);

  function zoomBy(factor: number) {
    setView((v) => ({
      ...v,
      z: Math.max(minZoom, Math.min(maxZoom, v.z * factor)),
    }));
  }
  function reset() {
    setView({ x: 60, y: 60, z: initialZoom });
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="relative h-[calc(100vh-14rem)] min-h-[520px] w-full cursor-grab overflow-hidden rounded-2xl border border-outline-light bg-[radial-gradient(circle_at_2px_2px,rgba(11,61,46,0.12)_1px,transparent_0)] [background-size:24px_24px]"
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})`,
          willChange: "transform",
        }}
      >
        {children}
      </div>

      <div
        data-no-pan
        className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-lowest p-1 shadow-floating"
      >
        <button
          onClick={() => zoomBy(1.15)}
          className="h-8 w-8 rounded-full text-on-surface hover:bg-surface-high"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(0.87)}
          className="h-8 w-8 rounded-full text-on-surface hover:bg-surface-high"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="mono px-2 text-xs text-on-surface-variant">
          {Math.round(view.z * 100)}%
        </span>
        <button
          onClick={reset}
          className="h-8 rounded-full px-3 text-[10px] font-bold uppercase tracking-wider text-on-surface hover:bg-surface-high"
        >
          Reset
        </button>
      </div>

      <div
        data-no-pan
        className="pointer-events-none absolute bottom-4 left-4 select-none rounded-full bg-surface-lowest/70 px-3 py-1 text-[10px] uppercase tracking-wider text-white/80"
      >
        Drag · Scroll to zoom
      </div>
    </div>
  );
}
