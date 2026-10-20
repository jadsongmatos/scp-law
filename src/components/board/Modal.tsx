// MURAL DE PISTAS — modal genérico (portado do protótipo Nexo).
// Portal para o elemento em tela cheia ou para dentro de .mural-overlay:
// o overlay do mural tem z-index 300, acima do .modal-overlay (200) — portar
// para dentro do overlay garante que o modal apareça sobre o quadro.
// A classe .modal-overlay é usada como guarda de teclado pelo Board.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, eyebrow, onClose, children, wide = false, className = '' }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [portalTarget, setPortalTarget] = useState<Element>(() => document.fullscreenElement || document.body);

  useLayoutEffect(() => {
    const syncTarget = () => setPortalTarget(document.fullscreenElement || document.querySelector('.mural-overlay') || document.body);
    syncTarget();
    document.addEventListener('fullscreenchange', syncTarget);
    return () => document.removeEventListener('fullscreenchange', syncTarget);
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const focusable = panel.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, button[data-autofocus]');
      (focusable || panel.current)?.focus();
    });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const elements = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([type="hidden"]), select, textarea, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handleKey, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className={`modal-overlay ${className}`} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={panel}>
        <div className="modal-heading">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id={id}>{title}</h2></div>
          <button className="icon-button modal-close" onClick={onClose} title="Fechar" aria-label="Fechar janela"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    portalTarget,
  );
}
