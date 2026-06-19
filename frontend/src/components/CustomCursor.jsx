import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)');
    if (!mediaQuery.matches) return;

    let visible = false;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Show cursors
    dot.style.opacity = '0';
    ring.style.opacity = '0';

    const handleMouseMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      // Directly set transform — no React re-render
      dot.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
      ring.style.transform = `translate(${x - 12}px, ${y - 12}px)`;
      if (!visible) {
        dot.style.opacity = '1';
        ring.style.opacity = '1';
        visible = true;
      }
    };

    const handleMouseLeave = () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      visible = false;
    };

    const handleMouseDown = () => {
      dot.style.scale = '0.7';
      ring.style.scale = '0.8';
    };

    const handleMouseUp = () => {
      dot.style.scale = '1';
      ring.style.scale = '1';
    };

    // Use event delegation — check target tag only
    const handleMouseOver = (e) => {
      const t = e.target;
      const clickable =
        t.tagName === 'BUTTON' ||
        t.tagName === 'A' ||
        t.tagName === 'SELECT' ||
        t.tagName === 'INPUT' ||
        t.closest('a') ||
        t.closest('button') ||
        t.classList.contains('cursor-pointer');

      if (clickable) {
        ring.style.width = '32px';
        ring.style.height = '32px';
        ring.style.backgroundColor = 'rgba(72,110,93,0.1)';
        ring.style.borderColor = 'rgba(72,110,93,0.8)';
      } else {
        ring.style.width = '24px';
        ring.style.height = '24px';
        ring.style.backgroundColor = 'transparent';
        ring.style.borderColor = 'rgba(72,110,93,0.4)';
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('mouseover', handleMouseOver, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <>
      {/* Center dot — positioned via direct DOM transform */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-2 w-2 rounded-full bg-command-accent"
        style={{ willChange: 'transform', transition: 'scale 0.1s ease', opacity: 0 }}
      />
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] h-6 w-6 rounded-full border border-command-accent/40"
        style={{
          willChange: 'transform',
          transition: 'width 0.2s ease, height 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, scale 0.1s ease',
          opacity: 0,
        }}
      />
    </>
  );
}
