"use client";
import { useEffect, useRef } from "react";
export function MotionSurface({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    for (const item of element.querySelectorAll(".reveal"))
      observer.observe(item);
    element.classList.add("motion-ready");
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={root}
      className="motion-surface"
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--pointer-x",
          `${((event.clientX - rect.left) / rect.width - 0.5) * 28}px`,
        );
        event.currentTarget.style.setProperty(
          "--pointer-y",
          `${((event.clientY - rect.top) / rect.height - 0.5) * 20}px`,
        );
      }}
    >
      {children}
    </div>
  );
}
