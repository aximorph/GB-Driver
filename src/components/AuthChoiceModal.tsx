/**
 * AuthChoiceModal.tsx
 * Shown when user tries to start a shift without any auth mode set.
 * Step 1: Choose Google or Guest
 * Step 2 (if Guest): Warning about local-only storage
 */
import { useState } from 'react';
import { Chrome, UserX, ShieldAlert, HardDrive } from 'lucide-react';
import { useT } from '@/context/LangContext';

interface Props {
  onSelectGoogle: () => void; // navigate to profile / trigger Google login
  onSelectGuest: () => void;  // confirmed guest → proceed
  onClose: () => void;
}

export default function AuthChoiceModal({ onSelectGoogle, onSelectGuest, onClose }: Props) {
  const t = useT();
  const [step, setStep] = useState<'choice' | 'guest-warning'>('choice');

  if (step === 'guest-warning') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={onClose}>
        <div
          className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom"
          onClick={e => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-warning/15 border border-warning/30 flex items-center justify-center">
              <ShieldAlert size={28} className="text-warning" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-extrabold text-white">{t('auth_guest_warning_title')}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('auth_guest_warning_desc')}
            </p>
          </div>

          {/* Bullet points */}
          <div className="bg-white/5 rounded-2xl p-4 space-y-2.5">
            {[
              t('auth_guest_bullet_local'),
              t('auth_guest_bullet_browser'),
              t('auth_guest_bullet_nobackup'),
              t('auth_guest_bullet_switch'),
            ].map((txt, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-warning text-xs mt-0.5">•</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{txt}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={onSelectGuest}
              className="w-full py-3.5 rounded-2xl bg-warning/15 border border-warning/30 text-warning font-bold text-sm hover:bg-warning/25 transition-all"
            >
              {t('auth_guest_confirm')}
            </button>
            <button
              onClick={() => setStep('choice')}
              className="w-full py-3.5 rounded-2xl bg-secondary border border-white/5 text-muted-foreground hover:text-white font-bold text-sm transition-all"
            >
              {t('auth_back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1 — choice
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[430px] bg-card/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2rem] p-6 space-y-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-extrabold text-white">{t('auth_choice_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('auth_choice_desc')}</p>
        </div>

        {/* Google option */}
        <button
          onClick={onSelectGoogle}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Chrome size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{t('auth_google_option')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('auth_google_desc')}</p>
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg shrink-0">
            {t('auth_recommended')}
          </span>
        </button>

        {/* Guest option */}
        <button
          onClick={() => setStep('guest-warning')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
            <UserX size={22} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{t('auth_guest_option')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('auth_guest_short_desc')}</p>
          </div>
        </button>

        {/* Dismiss */}
        <button onClick={onClose} className="w-full py-3 text-xs text-muted-foreground hover:text-white transition-colors">
          {t('auth_cancel')}
        </button>
      </div>
    </div>
  );
}
