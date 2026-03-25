export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'manager';
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  status: 'active' | 'idle' | 'offline';
  lastSeen: string;
  currentApp?: string;
}

export interface ActivityLog {
  id?: string;
  employeeId: string;
  timestamp: string;
  type: 'app_switch' | 'idle_start' | 'idle_end' | 'heartbeat';
  details?: {
    appName?: string;
    windowTitle?: string;
    duration?: number;
  };
}
