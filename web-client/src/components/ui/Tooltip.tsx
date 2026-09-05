import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface TooltipState {
  visible: boolean;
  content: string;
  hint?: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

const TooltipContext = createContext<{
  showTooltip: (content: string, hint?: string, targetRect?: DOMRect) => void;
  hideTooltip: () => void;
}>({
  showTooltip: () => {},
  hideTooltip: () => {},
});

export const useTooltip = () => useContext(TooltipContext);

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    content: '',
    hint: undefined,
    x: 0,
    y: 0,
    placement: 'top',
  });

  const timerRef = useRef<any>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);

  const calculatePosition = (
    rect: DOMRect,
    tooltipWidth: number = 140,
    tooltipHeight: number = 44
  ): { x: number; y: number; placement: 'top' | 'bottom' } => {
    const targetCenterX = rect.left + rect.width / 2;
    const padding = 8;

    // Prefer top, flip to bottom if too close to viewport top
    const placeTop = rect.top >= tooltipHeight + 12;
    const placement: 'top' | 'bottom' = placeTop ? 'top' : 'bottom';

    let x = targetCenterX - tooltipWidth / 2;
    // Bound check horizontal viewport
    if (x < padding) x = padding;
    if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - padding - tooltipWidth;
    }

    const y = placeTop ? rect.top - 8 : rect.bottom + 8;

    return { x, y, placement };
  };

  const showTooltip = (content: string, hint?: string, targetRect?: DOMRect) => {
    if (!content) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (targetRect) {
      const { x, y, placement } = calculatePosition(targetRect);
      setTooltip({
        visible: true,
        content,
        hint,
        x,
        y,
        placement,
      });
    }
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTooltip(prev => ({ ...prev, visible: false }));
    currentTargetRef.current = null;
  };

  useEffect(() => {
    const handlePointerOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-tooltip]') as HTMLElement | null;
      if (!target) return;

      const content = target.getAttribute('data-tooltip');
      if (!content) return;

      const hint = target.getAttribute('data-tooltip-hint') || undefined;
      currentTargetRef.current = target;

      if (timerRef.current) clearTimeout(timerRef.current);
      // Fast, responsive 60ms micro-delay
      timerRef.current = setTimeout(() => {
        if (currentTargetRef.current === target) {
          const rect = target.getBoundingClientRect();
          const { x, y, placement } = calculatePosition(rect);
          setTooltip({
            visible: true,
            content,
            hint,
            x,
            y,
            placement,
          });
        }
      }, 60);
    };

    const handlePointerOut = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-tooltip]') as HTMLElement | null;
      if (!target) return;
      if (currentTargetRef.current === target) {
        hideTooltip();
      }
    };

    const handleScroll = () => {
      if (tooltip.visible) {
        hideTooltip();
      }
    };

    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [tooltip.visible]);

  return (
    <TooltipContext.Provider value={{ showTooltip, hideTooltip }}>
      {children}
      {/* Sleek Modern Floating Tooltip Portal */}
      {tooltip.visible && (
        <div
          role="tooltip"
          className="fixed z-[9999] pointer-events-none duration-100 ease-out animate-in fade-in zoom-in-95"
          style={{
            left: `${tooltip.x}px`,
            top: tooltip.placement === 'top' ? 'auto' : `${tooltip.y}px`,
            bottom: tooltip.placement === 'top' ? `${window.innerHeight - tooltip.y}px` : 'auto',
          }}
        >
          <div className="relative flex flex-col items-center">
            {/* Tooltip Content Card */}
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-slate-100 text-center shadow-xl shadow-black/30 border border-slate-700/60 dark:border-slate-800/80 min-w-max max-w-xs">
              <div className="text-[12px] font-semibold tracking-wide flex items-center justify-center gap-1.5 leading-tight">
                {tooltip.content}
              </div>
              {tooltip.hint && (
                <div className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">
                  {tooltip.hint}
                </div>
              )}
            </div>

            {/* Micro Arrow / Caret */}
            <div
              className={`size-2 bg-slate-900/95 dark:bg-slate-950/95 border-slate-700/60 dark:border-slate-800/80 rotate-45 absolute ${
                tooltip.placement === 'top'
                  ? '-bottom-1 border-r border-b'
                  : '-top-1 border-l border-t'
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </TooltipContext.Provider>
  );
};

export interface TooltipProps {
  content: string;
  hint?: string;
  children: React.ReactElement;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, hint, children }) => {
  return React.cloneElement(children, {
    'data-tooltip': content,
    'data-tooltip-hint': hint,
  } as any);
};
