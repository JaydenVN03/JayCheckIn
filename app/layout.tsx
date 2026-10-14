import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điểm danh lớp',
  description: 'Hệ thống điểm danh lớp học đơn giản, nhanh chóng và rõ ràng.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
