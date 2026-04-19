import { useEffect } from 'react';

interface SweetAlertProps {
  show: boolean;
  icon?: 'warning' | 'info' | 'success' | 'error';
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const ICON_CONFIG = {
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    emoji: '⚠️',
    ring: 'shadow-amber-500/20',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    emoji: 'ℹ️',
    ring: 'shadow-blue-500/20',
  },
  success: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    emoji: '✅',
    ring: 'shadow-primary/20',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    emoji: '❌',
    ring: 'shadow-destructive/20',
  },
};

export default function SweetAlert({
  show,
  icon = 'warning',
  title,
  description,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
}: SweetAlertProps) {
  const handleDismiss = () => (onCancel ?? onConfirm)();

  // Close on Escape
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, onConfirm, onCancel]);

  if (!show) return null;

  const cfg = ICON_CONFIG[icon];

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onConfirm}
    >
      <div
        className="w-full max-w-[320px] bg-card/95 border border-white/10 rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 animate-in zoom-in-90 fade-in duration-200"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Icon circle */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-lg ${cfg.bg} ${cfg.border} ${cfg.ring}`}>
          <span className="text-4xl select-none">{cfg.emoji}</span>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>

        {/* Buttons */}
        <div className={`w-full ${cancelText ? 'grid grid-cols-2 gap-3' : ''}`}>
          {cancelText && onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-3.5 rounded-2xl bg-secondary text-muted-foreground font-bold text-sm border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            autoFocus
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-[#00b050] text-white font-extrabold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
