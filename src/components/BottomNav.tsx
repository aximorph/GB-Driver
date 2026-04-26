import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getActiveSession } from '@/lib/storage';
import { Home, Clock, BarChart2, Settings, Plus } from 'lucide-react';
import SweetAlert from './SweetAlert';
import { useT } from '@/context/LangContext';
import { useIsLandscape } from '@/hooks/useIsLandscape';

export default function BottomNav() {
  const navigate = useNavigate();
  const t = useT();
  const isLandscape = useIsLandscape();
  const [isOnShift, setIsOnShift] = useState(!!getActiveSession());
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handler = () => setIsOnShift(!!getActiveSession());
    window.addEventListener('gbdriver:session-changed', handler);
    return () => window.removeEventListener('gbdriver:session-changed', handler);
  }, []);

  const handleAddClick = () => {
    const activeNow = !!getActiveSession();
    if (activeNow) {
      if (!isOnShift) setIsOnShift(true);
      navigate('/');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gbdriver:open-add-entry'));
      }, 50);
    } else {
      setShowAlert(true);
    }
  };

  /* ── Side Nav (landscape) ─────────────────────────────────────────── */
  if (isLandscape) {
    const sideLink = ({ isActive }: { isActive: boolean }) =>
      `flex flex-col items-center gap-1 py-3 px-2 w-full rounded-xl transition-colors ${
        isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      }`;

    return (
      <>
        <SweetAlert
          show={showAlert}
          icon="warning"
          title={t('nav_no_shift_title')}
          description={t('nav_no_shift_desc')}
          confirmText={t('nav_got_it')}
          onConfirm={() => setShowAlert(false)}
        />

        <nav className="fixed left-0 top-0 h-screen w-[72px] bg-card/90 backdrop-blur-2xl border-r border-white/5 z-30 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.5)] flex flex-col items-center py-4 gap-1 overflow-hidden">
          <NavLink to="/" className={sideLink} end>
            <Home size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-bold">{t('nav_dashboard')}</span>
          </NavLink>

          <NavLink to="/history" className={sideLink}>
            <Clock size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-bold">{t('nav_history')}</span>
          </NavLink>

          {/* Add button — centre of stack */}
          <div className="flex-1 flex items-center justify-center w-full px-2">
            <button
              onClick={handleAddClick}
              className={`flex flex-col items-center gap-1 w-full py-3 rounded-xl transition-all ${
                isOnShift
                  ? 'bg-gradient-to-b from-primary to-[#00b050] text-white shadow-lg shadow-primary/30 hover:scale-105'
                  : 'bg-secondary border border-white/5 text-muted-foreground opacity-50'
              }`}
            >
              <Plus size={24} strokeWidth={2.5} />
              <span className="text-[9px] font-bold">{t('nav_add')}</span>
            </button>
          </div>

          <NavLink to="/analytics" className={sideLink}>
            <BarChart2 size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-bold">{t('nav_analytics')}</span>
          </NavLink>

          <NavLink to="/profile" className={sideLink}>
            <Settings size={22} strokeWidth={2.5} />
            <span className="text-[9px] font-bold">{t('nav_profile')}</span>
          </NavLink>
        </nav>

        {/* Spacer so content isn't hidden behind fixed side nav */}
        <div className="w-[72px] shrink-0" />
      </>
    );
  }

  /* ── Bottom Nav (portrait) ────────────────────────────────────────── */
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-xs transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`;

  return (
    <>
      <SweetAlert
        show={showAlert}
        icon="warning"
        title={t('nav_no_shift_title')}
        description={t('nav_no_shift_desc')}
        confirmText={t('nav_got_it')}
        onConfirm={() => setShowAlert(false)}
      />

      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-2xl border-t border-white/5 z-30 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
        <div className="max-w-[430px] mx-auto flex justify-around items-end py-3 px-2 pb-6">
          <NavLink to="/" className={linkClass} end>
            <Home size={22} strokeWidth={2.5} className="mb-0.5" />
            <span>{t('nav_dashboard')}</span>
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <Clock size={22} strokeWidth={2.5} className="mb-0.5" />
            <span>{t('nav_history')}</span>
          </NavLink>

          {/* Center Add Button */}
          <button
            onClick={handleAddClick}
            className={`flex flex-col items-center gap-1 -mt-8 transition-all ${
              isOnShift
                ? 'text-primary drop-shadow-[0_0_10px_rgba(0,242,96,0.3)]'
                : 'text-muted-foreground opacity-50'
            }`}
          >
            <span className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-xl transition-transform ${
              isOnShift
                ? 'bg-gradient-to-tr from-primary to-[#00f260] text-white shadow-primary/30 hover:scale-105 hover:-rotate-3'
                : 'bg-secondary border border-white/5 text-muted-foreground'
            }`}>
              <Plus size={32} strokeWidth={2.5} />
            </span>
            <span className="text-xs">{t('nav_add')}</span>
          </button>

          <NavLink to="/analytics" className={linkClass}>
            <BarChart2 size={22} strokeWidth={2.5} className="mb-0.5" />
            <span>{t('nav_analytics')}</span>
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <Settings size={22} strokeWidth={2.5} className="mb-0.5" />
            <span>{t('nav_profile')}</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
}
