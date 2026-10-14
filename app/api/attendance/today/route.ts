import { NextResponse } from 'next/server';
import { students } from '@/lib/students';
import { getVietnamToday } from '@/lib/attendance';
import {
  AttendanceBackendError,
  callAttendanceBackend,
  type AttendanceRecord,
} from '@/lib/google-apps-script';

export const dynamic = 'force-dynamic';

type TodayResponse = {
  date: string;
  saved: boolean;
  attendance?: AttendanceRecord[];
  savedAt?: string;
};

export async function GET() {
  try {
    const result = await callAttendanceBackend<TodayResponse>({ action: 'today' });
    const today = getVietnamToday();

    if (
      !result ||
      result.date !== today ||
      typeof result.saved !== 'boolean' ||
      !Array.isArray(result.attendance)
    ) {
      throw new AttendanceBackendError(
        'SHEETS_UNAVAILABLE',
        'Google Apps Script trả về dữ liệu điểm danh không hợp lệ.',
      );
    }

    if (
      result.saved &&
      (!Array.isArray(result.attendance) ||
        result.attendance.length !== students.length ||
        result.attendance.some((record) => !record || typeof record.studentId !== 'string') ||
        new Set(result.attendance.map((record) => record.studentId)).size !== students.length ||
        students.some((student) => !result.attendance?.some(
          (record) => record.studentId === student.id &&
            (record.status === 'PRESENT' || record.status === 'ABSENT'),
        )) ||
        typeof result.savedAt !== 'string')
    ) {
      throw new AttendanceBackendError(
        'SHEETS_UNAVAILABLE',
        'Dữ liệu điểm danh trong Google Sheets không đầy đủ.',
      );
    }

    if (!result.saved && result.attendance.length > 0) {
      throw new AttendanceBackendError(
        'SHEETS_UNAVAILABLE',
        'Google Apps Script trả về trạng thái điểm danh chưa nhất quán.',
      );
    }

    return NextResponse.json({
      date: result.date,
      saved: result.saved,
      attendance: result.attendance ?? [],
      savedAt: result.savedAt,
      students,
    });
  } catch (error) {
    if (error instanceof AttendanceBackendError) {
      const status = error.code === 'VALIDATION_ERROR' ? 400 : 503;
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status },
      );
    }

    console.error('Failed to load attendance from Google Sheets.', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Không thể tải dữ liệu điểm danh.' },
      { status: 500 },
    );
  }
}
