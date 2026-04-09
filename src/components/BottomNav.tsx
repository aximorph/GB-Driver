import { NavLink, useNavigate } from 'react-router-dom';
import { getActiveSession } from '@/lib/storage';
import { Home, Clock, BarChart2, User, Plus } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const activeSession = getActiveSession();
  const isOnShift = !!activeSession;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-xs transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`;

  const handleAddClick = () => {
    if (isOnShift) {
      navigate('/');
      // Small delay to ensure Dashboard is mounted before dispatching
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gbdriver:open-add-entry'));
      }, 100);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-2xl border-t border-white/5 z-30 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
      <div className="max-w-[430px] mx-auto flex justify-around items-end py-3 px-2 pb-6">
        <NavLink to="/" className={linkClass} end>
          <Home size={22} strokeWidth={2.5} className="mb-0.5" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          <Clock size={22} strokeWidth={2.5} className="mb-0.5" />
          <span>History</span>
        </NavLink>

        {/* Center Add Button */}
        <button
          onClick={handleAddClick}
          disabled={!isOnShift}
          className={`flex flex-col items-center gap-1 -mt-8 transition-all ${
            isOnShift
              ? 'text-primary drop-shadow-[0_0_10px_rgba(0,242,96,0.3)]'
              : 'text-muted-foreground opacity-50 cursor-not-allowed'
          }`}
        >
          <span className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-xl transition-transform ${
            isOnShift
              ? 'bg-gradient-to-tr from-primary to-[#00f260] text-white shadow-primary/30 hover:scale-105 hover:-rotate-3'
              : 'bg-secondary border border-white/5 text-muted-foreground'
          }`}>
            <Plus size={32} strokeWidth={2.5} />
          </span>
          <span className="text-xs">Add</span>
        </button>

        <NavLink to="/analytics" className={linkClass}>
          <BarChart2 size={22} strokeWidth={2.5} className="mb-0.5" />
          <span>Analytics</span>
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <User size={22} strokeWidth={2.5} className="mb-0.5" />
          <span>Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
