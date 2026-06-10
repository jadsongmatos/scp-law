const MARGIN = 8;

export function adjustMenuPosition(
  el: HTMLDivElement,
  desiredX: number,
  desiredY: number,
): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  const x = desiredX + w + MARGIN > vw
    ? Math.max(MARGIN, desiredX - w)
    : desiredX;
  const y = desiredY + h + MARGIN > vh
    ? Math.max(MARGIN, desiredY - h)
    : desiredY;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

import React, { useEffect, useRef, useState } from 'react';

export function useMenuPosition(
  ref: React.RefObject<HTMLDivElement | null>,
  x: number | null,
  y: number | null,
): { x: number; y: number } {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (x === null || y === null || !ref.current) {
      setPos({ x: 0, y: 0 });
      return;
    }
    const el = ref.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    const px = x + w + MARGIN > vw
      ? Math.max(MARGIN, x - w)
      : x;
    const py = y + h + MARGIN > vh
      ? Math.max(MARGIN, y - h)
      : y;

    setPos({ x: px, y: py });
  }, [ref, x, y]);

  return pos;
}
