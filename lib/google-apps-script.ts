import type { AttendanceStatus } from '@/lib/students';

export type AttendanceRecord = {
  studentId: string;
  status: AttendanceStatus;
};

type AppsScriptSuccess<T> = {
  ok: true;
  data: T;
};

type AppsScriptFailure = {
  ok: false;
  code: string;
  message?: string;
};

type AppsScriptResponse<T> = AppsScriptSuccess<T> | AppsScriptFailure;

export class AttendanceBackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AttendanceBackendError';
  }
}

function getConfiguration() {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!endpoint || !token || !spreadsheetId) {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'Thiếu cấu hình Google Sheets ở môi trường máy chủ.',
    );
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'URL Google Apps Script chưa hợp lệ.',
    );
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)
  ) {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'Cần URL Web App đã triển khai của Google Apps Script.',
    );
  }

  return { endpoint: url.toString(), token, spreadsheetId };
}

export async function callAttendanceBackend<T>(
  request: { action: 'today' } | {
    action: 'save';
    date: string;
    attendance: AttendanceRecord[];
  },
): Promise<T> {
  const { endpoint, token, spreadsheetId } = getConfiguration();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ ...request, token, spreadsheetId }),
    });
  } catch {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'Không thể kết nối Google Sheets. Vui lòng kiểm tra mạng và cấu hình Apps Script.',
    );
  }

  let payload: AppsScriptResponse<T>;
  try {
    payload = (await response.json()) as AppsScriptResponse<T>;
  } catch {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'Google Apps Script trả về phản hồi không hợp lệ.',
    );
  }

  if (!response.ok) {
    throw new AttendanceBackendError(
      'SHEETS_UNAVAILABLE',
      'Google Apps Script không thể xử lý yêu cầu.',
    );
  }

  if (!payload || payload.ok !== true) {
    const failure = payload as AppsScriptFailure;
    const code = failure?.code === 'ATTENDANCE_ALREADY_SAVED'
      ? failure.code
      : failure?.code === 'VALIDATION_ERROR'
        ? failure.code
        : 'SHEETS_UNAVAILABLE';
    throw new AttendanceBackendError(
      code,
      failure?.message || 'Google Sheets từ chối yêu cầu.',
    );
  }

  return payload.data;
}
