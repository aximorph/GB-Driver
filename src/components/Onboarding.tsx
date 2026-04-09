import { useState } from 'react';
import { DriverProfile } from '@/lib/types';
import { saveProfile } from '@/lib/storage';
import { Zap, Fuel } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [vehicleType, setVehicleType] = useState<'electric' | 'petrol'>('petrol');
  const [schedule, setSchedule] = useState<DriverProfile['schedule']>(
    Object.fromEntries(DAYS.map(d => [d, { start: '08:00', end: '20:00', enabled: true }]))
  );

  const handleSave = () => {
    const profile: DriverProfile = {
      vehicleType,
      commissionRate: 0.20,
      schedule,
    };
    saveProfile(profile);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    onComplete();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-32 -translate-y-32"></div>
      <div className="w-full max-w-[430px] space-y-6 z-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#00f260] to-primary bg-clip-text text-transparent drop-shadow-sm tracking-tight mb-2">GB-Driver</h1>
          <p className="text-muted-foreground text-sm font-medium">Set up your driver profile</p>
          <div className="flex justify-center gap-2 pt-2">
            {[0, 1].map(i => (
              <div key={i} className={`h-1.5 w-12 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground text-center">Vehicle Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['electric', 'petrol'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setVehicleType(type)}
                  className={`p-6 rounded-lg border-2 text-center transition-all ${
                    vehicleType === type
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex justify-center mb-3 text-primary">
                    {type === 'electric' ? <Zap size={36} strokeWidth={1.5} /> : <Fuel size={36} strokeWidth={1.5} />}
                  </div>
                  <div className="font-medium text-sm">{type === 'electric' ? 'Electric' : 'Petrol/Gas'}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground text-center">Work Schedule</h2>
            <div className="space-y-2">
              {DAYS.map(day => (
                <div key={day} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule[day].enabled}
                      onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], enabled: e.target.checked } }))}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-foreground font-medium w-10 text-sm">{day}</span>
                  </label>
                  <input
                    type="time"
                    value={schedule[day].start}
                    onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], start: e.target.value } }))}
                    disabled={!schedule[day].enabled}
                    className="bg-secondary text-foreground rounded px-2 py-1 text-sm font-mono disabled:opacity-40"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <input
                    type="time"
                    value={schedule[day].end}
                    onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], end: e.target.value } }))}
                    disabled={!schedule[day].enabled}
                    className="bg-secondary text-foreground rounded px-2 py-1 text-sm font-mono disabled:opacity-40"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Start Driving
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
