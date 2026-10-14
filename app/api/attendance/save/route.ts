import { NextResponse } from 'next/server';
import { students } from '@/lib/students';
import { getVietnamToday } from '@/lib/attendance';
import {
  AttendanceBackendError,
  callAttendanceBackend,
  type AttendanceRecord,
} from '@/lib/google-apps-script';
import {
  isMemoryAttendanceMode,
  saveMemoryAttendance,
} from '@/lib/attendance-memory-store';

export const dynamic = 'force-dynamic';

type Payload = {
  date?: unknown;
  attendance?: unknown;
};

function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.studentId === 'string' &&
    (record.status === 'PRESENT' || record.status === 'ABSENT');
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Request phải là JSON hợp lệ.' },
      { status: 400 },
    );
  }

  const { date, attendance } = body ?? {};
  const today = getVietnamToday();

  if (typeof date !== 'string' || !Array.isArray(attendance)) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Thiếu dữ liệu ngày hoặc danh sách điểm danh.' },
      { status: 400 },
    );
  }

  if (date !== today) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Chỉ cho phép điểm danh ngày hiện tại.' },
      { status: 400 },
    );
  }

  const entries = attendance.filter(isAttendanceRecord);
  if (entries.length !== attendance.length) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Mỗi học viên phải có mã và trạng thái hợp lệ.' },
      { status: 400 },
    );
  }

  const studentIds = students.map((student) => student.id);
  const receivedIds = entries.map((item) => item.studentId);
  const uniqueIds = new Set(receivedIds);

  if (
    students.length !== entries.length ||
    uniqueIds.size !== entries.length ||
    !studentIds.every((id) => receivedIds.includes(id)) ||
    !receivedIds.every((id) => studentIds.includes(id))
  ) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Danh sách học viên không khớp với cấu hình backend.' },
      { status: 400 },
    );
  }

  try {
    if (isMemoryAttendanceMode()) {
      const result = saveMemoryAttendance(date, entries);
      if (!result) {
        return NextResponse.json(
          { code: 'ATTENDANCE_ALREADY_SAVED', message: 'Ngày này đã được lưu.' },
          { status: 409 },
        );
      }

      return NextResponse.json({
        code: 'SUCCESS',
        message: 'Đã lưu tạm trong bộ nhớ của máy chủ.',
        savedAt: result.savedAt,
        storageMode: 'memory',
      });
    }

    const result = await callAttendanceBackend<{ savedAt?: unknown }>({
      action: 'save',
      date,
      attendance: entries,
    });

    if (!result || typeof result.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result.savedAt)) {
      throw new AttendanceBackendError(
        'SHEETS_UNAVAILABLE',
        'Google Apps Script chưa xác nhận lưu dữ liệu thành công.',
      );
    }

    return NextResponse.json({
      code: 'SUCCESS',
      message: 'Lưu điểm danh thành công.',
      savedAt: result.savedAt,
    });
  } catch (error) {
    if (error instanceof AttendanceBackendError) {
      const status = error.code === 'ATTENDANCE_ALREADY_SAVED'
        ? 409
        : error.code === 'VALIDATION_ERROR'
          ? 400
          : 503;
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status },
      );
    }

    console.error('Failed to save attendance to Google Sheets.', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ khi lưu điểm danh.' },
      { status: 500 },
    );
  }
}
