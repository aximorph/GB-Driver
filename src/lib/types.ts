export interface IntensiveTier {
  trips: number;
  bonus: number;
}

export interface Intensive {
  id: string;
  name: string;
  enabled: boolean;   // user can toggle on/off without deleting
  startTime?: string; // "HH:mm" optional — only count trips within this window
  endTime?: string;   // "HH:mm" optional
  tiers: IntensiveTier[];
}

export interface DriverProfile {
  vehicleType: 'electric' | 'petrol';
  fuelType?: 'diesel' | '91' | '95' | 'e20';
  chargingType?: 'home' | 'public';
  commissionRate: number;
  dailyGoal?: number;
  intensives?: Intensive[];
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
}

export type ShiftStatus = 'offline' | 'on_shift' | 'shift_ended';
