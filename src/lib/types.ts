export interface IncentiveTier {
  trips: number;
  bonus: number;
}

export interface Incentive {
  id: string;
  name: string;
  tiers: IncentiveTier[];
}

export interface DriverProfile {
  vehicleType: 'electric' | 'petrol';
  fuelType?: 'diesel' | '91' | '95' | 'e20';
  chargingType?: 'home' | 'public';
  commissionRate: number;
  dailyGoal?: number;
  incentives?: Incentive[];
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
