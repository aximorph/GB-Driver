import { useState } from 'react';
import { BookOpen, ChevronDown, X } from 'lucide-react';
import { useT, useLang } from '@/context/LangContext';
import { GUIDE_SECTIONS } from '@/lib/guideContent';

interface Props {
  onClose: () => void;
}

export default function HowToUseModal({ onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  // First section open by default so the panel doesn't look empty on first view.
  const [openId, setOpenId] = useState<string | null>(GUIDE_SECTIONS[0]?.id ?? null);

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-card/95 backdrop-blur-3xl border border-white/10 rounded-[1.75rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0 border-b border-white/5">
          <div className="flex items-start gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 text-primary shrink-0 mt-0.5">
              <BookOpen size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-white leading-tight">{t('guide_title')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('guide_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-full w-7 h-7 flex items-center justify-center shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Accordion sections ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {GUIDE_SECTIONS.map(section => {
            const isOpen = openId === section.id;
            return (
              <div
                key={section.id}
                className={`rounded-2xl border transition-colors ${
                  isOpen ? 'border-primary/25 bg-primary/[0.04]' : 'border-white/5 bg-secondary/40'
                }`}
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
                >
                  <span className="text-base shrink-0">{section.emoji}</span>
                  <span className="flex-1 text-sm font-bold text-white">
                    {section.title[lang]}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 -mt-1">
                    <ol className="space-y-2">
                      {section.steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                          <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span>{step[lang]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
