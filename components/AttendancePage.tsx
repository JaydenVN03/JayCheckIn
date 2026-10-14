'use client';

import { useEffect, useMemo, useState } from 'react';
import { students, type AttendanceStatus, type Student } from '@/lib/students';
import { formatDisplayDate } from '@/lib/attendance';

type AttendanceEntry = {
  studentId: string;
  status: AttendanceStatus;
};

type AttendanceApiResponse = {
  date: string;
  saved: boolean;
  attendance?: AttendanceEntry[];
  storageMode?: 'memory' | 'google-sheets';
  students: Student[];
};

export default function AttendancePage() {
  const [date, setDate] = useState('');
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus | null>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [storageMode, setStorageMode] = useState<'memory' | 'google-sheets'>('google-sheets');

  useEffect(() => {
    const updatePageSize = () => {
      setPageSize(window.innerWidth < 768 ? 6 : 10);
    };

    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const response = await fetch('/api/attendance/today');
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message ?? 'Không thể tải dữ liệu điểm danh.');
        }
        const data: AttendanceApiResponse = await response.json();

        setDate(data.date);
        setSaved(data.saved);
        setStorageMode(data.storageMode ?? 'google-sheets');
        const savedAttendance = new Map(
          (data.attendance ?? []).map(({ studentId, status }) => [studentId, status]),
        );
        const initialStatusMap = Object.fromEntries(data.students.map((student) => [
          student.id,
          data.saved ? savedAttendance.get(student.id) ?? null : 'ABSENT',
        ])) as Record<string, AttendanceStatus | null>;
        setStatusMap(initialStatusMap);
        setIsReady(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu điểm danh.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToday();
  }, []);

  const totalPages = Math.ceil(students.length / pageSize);
  const firstVisibleNumber = (page - 1) * pageSize + 1;
  const lastVisibleNumber = Math.min(page * pageSize, students.length);
  const visibleStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages || 1);
  }, [page, totalPages]);

  const selectedCount = Object.values(statusMap).filter(Boolean).length;
  const presentCount = Object.values(statusMap).filter((status) => status === 'PRESENT').length;
  const absentCount = Object.values(statusMap).filter((status) => status === 'ABSENT').length;
  const unselectedCount = students.length - selectedCount;
  const absentStudents = students.filter((student) => statusMap[student.id] === 'ABSENT');

  const setStudentStatus = (studentId: string, nextStatus: AttendanceStatus) => {
    if (saved) return;
    setStatusMap((current) => ({ ...current, [studentId]: nextStatus }));
    setErrorMessage('');
  };

  const canSave = !saved && selectedCount === students.length && !isSubmitting;

  const handleSave = async () => {
    if (unselectedCount > 0) {
      setErrorMessage('Vui lòng chọn trạng thái cho tất cả học viên trước khi lưu.');
      return;
    }

    const confirmed = window.confirm(`Lưu điểm danh ngày ${formatDisplayDate(date)} cho ${students.length} học viên?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const payload: AttendanceEntry[] = students.map((student) => ({
      studentId: student.id,
      status: statusMap[student.id] ?? 'ABSENT',
    }));

    try {
      const response = await fetch('/api/attendance/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, attendance: payload }),
      });

      const result = await response.json();

      if (!response.ok) {
        const code = result?.code ?? 'INTERNAL_ERROR';
        if (code === 'ATTENDANCE_ALREADY_SAVED') {
          setErrorMessage('Ngày này đã được lưu trước đó. Không thể ghi lại.');
        } else if (code === 'VALIDATION_ERROR') {
          setErrorMessage(result.message ?? 'Dữ liệu điểm danh không hợp lệ.');
        } else {
          setErrorMessage('Lưu điểm danh thất bại. Vui lòng thử lại.');
        }
        return;
      }

      setSaved(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('Lỗi mạng khi lưu điểm danh. Các lựa chọn của bạn đã được giữ nguyên.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStudentCard = (student: Student) => {
    const selectedStatus = statusMap[student.id] ?? null;

    return (
      <div
        key={student.id}
        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {student.id}
          </span>
          <span className="text-xs text-slate-500">#{students.findIndex((item) => item.id === student.id) + 1}</span>
        </div>

        <p className="mb-4 min-h-[48px] text-base font-semibold leading-6 text-slate-800">{student.fullName}</p>

        <div className="grid grid-cols-2 gap-2">
          {(['PRESENT', 'ABSENT'] as const).map((status) => {
            const active = selectedStatus === status;
            const buttonClasses = [
              'flex min-h-[52px] items-center justify-center rounded-xl border text-sm font-semibold transition-all',
              active
                ? status === 'PRESENT'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                  : 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
              saved ? 'cursor-not-allowed opacity-80' : '',
            ].join(' ');

            return (
              <button
                key={status}
                type="button"
                disabled={saved}
                onClick={() => setStudentStatus(student.id, status)}
                className={buttonClasses}
              >
                {status === 'PRESENT' ? 'Có mặt' : 'Vắng'}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-700">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-soft">Đang tải dữ liệu...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">Danh sách lớp</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Điểm danh lớp</h1>
              <p className="mt-1 text-sm text-slate-500">{students.length} học viên</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
              <span className="font-medium text-slate-900">Ngày:</span> {date ? formatDisplayDate(date) : '---'}
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <p className="text-sm text-slate-500">Tổng số học viên</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{students.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-soft">
            <p className="text-sm text-emerald-700">Có mặt</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{presentCount}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-soft">
            <p className="text-sm text-red-700">Vắng</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{absentCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
            <p className="text-sm text-amber-700">Chưa chọn</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{unselectedCount}</p>
          </div>
        </section>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {saved && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Đã lưu — không thể chỉnh sửa.
          </div>
        )}

        {storageMode === 'memory' && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chế độ tạm thời: dữ liệu chỉ lưu trong bộ nhớ và sẽ mất khi khởi động lại máy chủ. Chưa ghi vào Google Sheets.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {visibleStudents.map((student) => renderStudentCard(student))}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Trang trước
            </button>

            <div className="text-base font-semibold text-slate-700">
              <span>Trang {page}/{totalPages}</span>
              <span className="mt-1 block text-center text-xs font-normal text-slate-500">
                Đang hiển thị {firstVisibleNumber}–{lastVisibleNumber} / {students.length} học viên
              </span>
            </div>

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Trang sau
            </button>
          </div>
        </section>

        {saved && (
          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-5 shadow-soft" aria-live="polite">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Danh sách học viên vắng</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Điểm danh ngày {formatDisplayDate(date)} · {absentStudents.length} học viên
                </p>
              </div>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                {absentStudents.length} vắng
              </span>
            </div>

            {absentStudents.length > 0 ? (
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {absentStudents.map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-red-700">
                      {students.findIndex((item) => item.id === student.id) + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-800">{student.fullName}</p>
                      <p className="text-xs text-slate-500">{student.id}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Hôm nay không có học viên vắng.
              </p>
            )}
          </section>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isReady || !canSave}
            className="w-full rounded-2xl bg-sky-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none lg:w-auto"
          >
            {isSubmitting ? 'Đang lưu...' : saved ? 'Đã lưu' : 'Lưu điểm danh'}
          </button>
        </div>
      </div>
    </main>
  );
}
