import type { ReactNode } from 'react';
import { useAfterSlide } from '../../hooks/useAfterSlide';
import { RevealGate } from './RevealGate';

interface SlideRevealProps {
  children: ReactNode;
  skeleton: ReactNode;
  dataReady?: boolean;
  startedAt?: number;
  className?: string;
  maxBlocks?: number;
}

/**
 * Keeps a page's heavy sections out of the slide, then hands them to the reveal
 * gate. The state lives here, so the page component itself does not re-render
 * when the tween finishes.
 */
export function SlideReveal({
  children,
  skeleton,
  dataReady = true,
  startedAt,
  className,
  maxBlocks,
}: SlideRevealProps) {
  const afterSlide = useAfterSlide();
  if (!afterSlide) return <>{skeleton}</>;
  return (
    <RevealGate
      startedAt={startedAt}
      dataReady={dataReady}
      skeleton={skeleton}
      className={className}
      maxBlocks={maxBlocks}
    >
      {children}
    </RevealGate>
  );
}
