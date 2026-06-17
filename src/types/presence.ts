export interface EmployeePresence {
  employee_id: string;
  status: 'working' | 'idle' | 'break' | 'offline';
  last_activity: string; // ISO timestamp
  last_heartbeat: string; // ISO timestamp
  break_started_at: string | null; // ISO timestamp
  updated_at: string; // ISO timestamp
  employees?: {
    name: string;
    role: string;
    department?: string;
  };
}

export interface PresenceStats {
  total: number;
  online: number;
  working: number;
  break: number;
  idle: number;
  offline: number;
  livePercentage: number;
}
