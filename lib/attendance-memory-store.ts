import type { AttendanceRecord } from '@/lib/google-apps-script';

type SavedAttendance = {
  savedAt: string;
  attendance: AttendanceRecord[];
};

const savedAttendanceByDate = new Map<string, SavedAttendance>();

export function isMemoryAttendanceMode(): boolean {
  return process.env.ATTENDANCE_STORAGE_MODE === 'memory';
}

export function getMemoryAttendance(date: string): SavedAttendance | undefined {
  return savedAttendanceByDate.get(date);
}

export function saveMemoryAttendance(
  date: string,
  attendance: AttendanceRecord[],
): SavedAttendance | undefined {
  const existing = savedAttendanceByDate.get(date);
  if (existing) {
    return undefined;
  }

  const saved: SavedAttendance = {
    savedAt: new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()).replace('T', ' '),
    attendance: attendance.map((entry) => ({ ...entry })),
  };
  savedAttendanceByDate.set(date, saved);
  return saved;
}
