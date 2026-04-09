export interface DriverProfile {
  vehicleType: 'electric' | 'petrol';
  commissionRate: number;
  schedule: Record<string, { start: string; end: string; enabled: boolean }>;
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
}

export type ShiftStatus = 'offline' | 'on_shift' | 'shift_ended';
