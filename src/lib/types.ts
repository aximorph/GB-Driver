export interface IntensiveTier {
  trips: number;
  bonus: number;
}

export type IntensiveCountsFor = 'ride' | 'express' | 'all';

export interface Intensive {
  id: string;
  name: string;
  enabled: boolean;
  countsFor: IntensiveCountsFor; // which Grab order types count toward this intensive
  startTime?: string;   // HH:mm daily time window
  endTime?: string;     // HH:mm daily time window
  dateStart?: string;   // YYYY-MM-DD campaign start date
  dateEnd?: string;     // YYYY-MM-DD campaign end date
  tiers: IntensiveTier[];
}

export interface DriverProfile {
  vehicleType: 'electric' | 'petrol';
  fuelType?: 'diesel' | '91' | '95' | 'e20';
  chargingType?: 'home' | 'public';
  commissionRate: number;
  dailyGoal?: number;
  intensives?: Intensive[];
  language?: 'en' | 'th';
  province?: string;        // province.id slug, used for presence feature
}

export interface ShiftSession {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  grabPayoutAmount?: number;
  entries: Entry[];
}

export interface Entry {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'income' | 'expense';
  platform?: 'grab' | 'bolt';   // income only, default grab
  orderType?: 'ride' | 'express'; // income only, default ride
  appFare?: number;
  customerPaid?: number;
  tip?: number;
  driverNet?: number;
  expenseCategory?: string;
  amount: number;
  note?: string;
  fuelPrice?: number;
  fuelLiters?: number;
  tripDuration?: number;    // seconds, income trips only
  tripStartTime?: string;   // ISO timestamp when trip started
}

export type ShiftStatus = 'offline' | 'on_shift' | 'shift_ended';
