import { useState } from 'react';
import { getProfile } from '@/lib/storage';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';

export default function Index() {
  const [hasProfile, setHasProfile] = useState(!!getProfile());

  if (!hasProfile) {
    return <Onboarding onComplete={() => setHasProfile(true)} />;
  }

  return <Dashboard />;
}
