import { useLayoutEffect, useState, type RefObject } from 'react';

/** Hai khung Khắc phục dùng cùng giới hạn chiều cao, tính từ mép trên tới đáy cửa sổ. */
export function useEqaPanelHeight(panelRef: RefObject<HTMLElement | null>, enabled = true) {
  const [maxHeight, setMaxHeight] = useState<number>();
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    const main = panel.closest('main');
    let frame = 0;
    const measure = () => {
      const style = getComputedStyle(panel);
      const inset = parseFloat(style.getPropertyValue('--space-4')) || 0;
      const padding = parseFloat(style.getPropertyValue('--panel-padding')) || 0;
      const control = parseFloat(style.getPropertyValue('--control-h')) || 0;
      const fixed = [...panel.querySelectorAll(':scope > .panel-head, :scope > .eqa-corrective-toolbar')]
        .reduce((height, node) => height + node.getBoundingClientRect().height, 0);
      setMaxHeight(Math.max(fixed + control + padding * 2, Math.floor(window.innerHeight - Math.max(0, panel.getBoundingClientRect().top) - inset)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(panel.closest('.eqa-corrective') ?? panel);
    if (main) observer?.observe(main);
    window.addEventListener('resize', schedule);
    main?.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener('resize', schedule);
      main?.removeEventListener('scroll', schedule);
    };
  }, [panelRef, enabled]);
  return maxHeight;
}
