# Hệ thống điểm danh lớp học

## 1. Mục tiêu

Xây dựng một web app điểm danh có giao diện đơn giản, dễ đọc tên và thao tác nhanh. Danh sách học viên được khai báo cố định trong mã nguồn, không cần database riêng. Google Sheets là nơi lưu lịch sử điểm danh.

### Nguyên tắc chính

- Không cần tài khoản cho người thao tác trong phiên bản MVP.
- Danh sách lớp được ghi cứng trong file cấu hình.
- Mỗi học viên có đúng một trạng thái trong ngày: **Có mặt** hoặc **Vắng**.
- Chỉ ghi dữ liệu khi người dùng nhấn **Lưu điểm danh**.
- Sau khi lưu thành công, bản ghi của ngày đó không được sửa hoặc ghi đè từ giao diện.
- Mỗi tháng lưu trong một tab (trang tính) riêng của cùng một Google Spreadsheet.
- Không dùng database riêng như Supabase/PostgreSQL.

## 2. Công nghệ đề xuất

Để giữ hệ thống đơn giản, có thể triển khai theo kiến trúc:

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS.
- **Lưu trữ:** Google Sheets.
- **Backend kết nối Google Sheets:** Google Apps Script Web App.
- **Tự động tạo tab tháng mới:** Apps Script time-driven trigger; đồng thời backend phải tự kiểm tra/tạo tab nếu cần khi lưu.
- **Triển khai frontend:** Vercel hoặc máy chủ hỗ trợ Next.js.

> Không đặt Google credential, token bí mật hoặc quyền chỉnh sửa Spreadsheet trong mã frontend. Nếu dùng Google Apps Script làm backend, chỉ frontend gọi endpoint đã cấu hình; backend cần kiểm tra dữ liệu đầu vào và chỉ cho phép các thao tác được định nghĩa.

### Luồng dữ liệu

1. Người dùng mở trang điểm danh.
2. Web hiển thị danh sách cố định theo cấu hình.
3. Người dùng chọn Có mặt/Vắng cho từng người.
4. Người dùng nhấn **Lưu điểm danh**.
5. Backend xác thực ngày, danh sách mã học viên và trạng thái.
6. Backend tìm tab theo tháng, ví dụ `2026-10`; nếu chưa có thì tạo.
7. Backend kiểm tra ngày đã được lưu chưa.
8. Nếu chưa lưu, backend ghi dữ liệu và trả kết quả thành công. Nếu đã lưu, từ chối ghi lần nữa và báo ngày này đã được lưu.
9. Một trigger chạy định kỳ mỗi tháng để tạo tab tháng mới. Cơ chế tự tạo khi lưu là lớp bảo vệ bổ sung, phòng trường hợp trigger bị lỗi.

## 3. Yêu cầu giao diện (UI/UX)

### 3.1 Bố cục

- Tiêu đề: **Điểm danh lớp**.
- Hiển thị ngày đang điểm danh ở đầu trang; mặc định là ngày hiện tại theo múi giờ `Asia/Ho_Chi_Minh`.
- Hiển thị tổng quan: tổng số học viên, số Có mặt, số Vắng, số chưa chọn.
- Máy tính/tablet ngang: **10 người mỗi trang**.
- Điện thoại: **6 người mỗi trang**.
- Có nút **Trang trước**, **Trang sau** và chỉ báo trang, ví dụ `Trang 2/4`.
- Cuối danh sách có nút **Lưu điểm danh**.
- Có trạng thái phản hồi rõ ràng: đang lưu, lưu thành công, lỗi lưu, ngày đã được lưu.

### 3.2 Thẻ học viên

Mỗi học viên hiển thị thành một thẻ/hàng lớn, có:
- Số thứ tự trong lớp.
- Họ và tên nổi bật, dễ đọc.
- Hai lựa chọn rõ ràng: **Có mặt** và **Vắng**.

Yêu cầu thao tác:
- Khu vực bấm đủ lớn trên màn hình cảm ứng.
- Không chỉ dùng màu để phân biệt; luôn có chữ “Có mặt” và “Vắng”.
- Trạng thái được chọn phải có viền/nền hoặc biểu tượng dễ nhận biết.
- Tên dài phải xuống dòng hợp lý, không bị cắt mất.
- Không dùng hiệu ứng trang trí gây rối mắt.

### 3.3 Trạng thái ban đầu

- Mặc định mỗi học viên là **Có mặt**; người thao tác có thể chuyển sang Vắng.
- Nút lưu bị vô hiệu hóa nếu dữ liệu chưa tải được hoặc đang gửi yêu cầu.
- Hiển thị rõ số người chưa chọn.
- Khi chuyển trang, lựa chọn của trang trước phải được giữ nguyên trong bộ nhớ giao diện.

### 3.4 Xác nhận trước khi lưu

Khi bấm **Lưu điểm danh**:
- Nếu còn người chưa chọn: không gửi dữ liệu; thông báo cần chọn trạng thái cho tất cả.
- Nếu đã đầy đủ: hiện hộp xác nhận ngắn, ví dụ: “Lưu điểm danh ngày 14/10/2026 cho 35 học viên?”
- Sau khi xác nhận, khóa nút lưu để tránh bấm nhiều lần.
- Chỉ hiển thị thành công khi backend xác nhận đã ghi dữ liệu.
- Sau khi lưu thành công, khóa các lựa chọn của ngày đó và hiển thị trạng thái **Đã lưu — không thể chỉnh sửa**; vẫn cho phép chuyển trang để xem danh sách.
- Hiển thị danh sách học viên vắng ở cuối trang sau khi lưu thành công.
- Nếu có lỗi mạng, giữ nguyên các lựa chọn để người dùng có thể thử lại. Backend vẫn phải chống ghi trùng.

## 4. Quy tắc nghiệp vụ

### 4.1 Danh sách lớp

Danh sách được khai báo trong mã nguồn, ví dụ:

```ts
// src/config/students.ts
export type Student = {
  id: string;       // Mã ổn định, không trùng nhau
  fullName: string;
};

export const students: Student[] = [
  { id: "SV001", fullName: "Nguyễn Văn A" },
  { id: "SV002", fullName: "Trần Thị B" },
  // Bổ sung danh sách lớp thật tại đây
];
```

- Dùng `id` ổn định để xác định học viên; không dùng tên làm khóa vì có thể trùng tên hoặc đổi tên.
- Danh sách chỉ được sửa bởi người phát triển khi cập nhật mã nguồn.
- Không cho thêm, xóa hoặc sửa tên học viên từ giao diện điểm danh.
- Ví dụ trong file chỉ là dữ liệu minh họa, cần thay bằng danh sách thật.

### 4.2 Trạng thái điểm danh

Giá trị hợp lệ:
- `PRESENT`: Có mặt.
- `ABSENT`: Vắng.

Không cho phép lưu giá trị rỗng hoặc giá trị ngoài danh sách trên.

### 4.3 Ngày điểm danh

- Dùng ngày theo múi giờ `Asia/Ho_Chi_Minh`.
- Định dạng ngày: `YYYY-MM-DD`, ví dụ `2026-10-14`.
- Backend tự xác định ngày hiện tại khi lưu hoặc kiểm tra ngày gửi lên; không tin hoàn toàn vào đồng hồ của trình duyệt.
- MVP chỉ điểm danh ngày hiện tại, không cho chọn ngày quá khứ/tương lai trên UI.

### 4.4 Không sửa sau khi lưu

- Mỗi ngày chỉ có một lần lưu thành công.
- Nếu ngày đã tồn tại trong Google Sheets, backend trả lỗi nghiệp vụ `ATTENDANCE_ALREADY_SAVED`.
- Không cung cấp API cập nhật hoặc xóa bản ghi đã lưu.
- Nếu cần sửa do sai sót thực tế, thực hiện theo quy trình quản trị ngoài MVP và ghi nhận thay đổi rõ ràng; không âm thầm ghi đè dữ liệu.
- Chống gửi trùng phải được xử lý ở backend, không chỉ bằng cách khóa nút trên frontend.

## 5. Thiết kế Google Sheets

Sử dụng một Google Spreadsheet duy nhất. Mỗi tháng là một tab, tên theo định dạng `YYYY-MM`, ví dụ:
- `2026-10`
- `2026-11`
- `2026-12`

### 5.1 Cấu trúc tab theo tháng

Mỗi hàng là một ngày điểm danh. Các cột cố định:

| Cột | Nội dung | Ví dụ |
|---|---|---|
| A | Ngày | `2026-10-14` |
| B | Thời điểm lưu | `2026-10-14 20:30:15` |
| C trở đi | Trạng thái của từng học viên, theo đúng thứ tự danh sách | `PRESENT`, `ABSENT` |

Hàng tiêu đề:
- A1: `attendance_date`
- B1: `saved_at`
- Từ C1 trở đi: mã học viên, ví dụ `SV001`, `SV002`, ...

Có thể thêm một hàng tiêu đề hiển thị tên để con người dễ đọc, nhưng mã học viên phải là định danh ổn định. Nếu lớp đông, nên dùng một hàng tiêu đề gồm mã và tên, hoặc tạo cột theo cặp mã/tên nếu ưu tiên đọc trực tiếp trong Sheets. Không thay đổi thứ tự cột khi đã có dữ liệu mà không có kế hoạch di chuyển dữ liệu.

### 5.2 Quy tắc ghi dữ liệu

- Ghi toàn bộ trạng thái của lớp trong một thao tác theo hàng, không ghi từng học viên thành nhiều request rời.
- Trước khi ghi, kiểm tra ngày chưa có bản ghi.
- Ghi `saved_at` theo múi giờ `Asia/Ho_Chi_Minh`.
- Nếu số lượng hoặc mã học viên từ frontend không khớp danh sách cấu hình phía backend, từ chối lưu.
- Chỉ trả thành công sau khi Google Sheets xác nhận thao tác ghi hoàn tất.
- Có thể thêm cột cuối `attendance_count` và `absence_count` để tiện tổng hợp, nhưng đây là tùy chọn.

### 5.3 Tạo tab tháng mới

- Tên tab phải theo `YYYY-MM`.
- Trigger tự động chạy vào đầu mỗi tháng theo múi giờ `Asia/Ho_Chi_Minh`, tạo tab tháng hiện tại nếu chưa tồn tại.
- Tab mới được tạo từ mẫu chuẩn: hàng tiêu đề, định dạng ngày, độ rộng cột, cố định hàng tiêu đề.
- Nếu tab đã tồn tại, không tạo tab trùng.
- Khi lưu, backend vẫn kiểm tra tab tháng và tự tạo nếu chưa tồn tại.
- Không xóa tab cũ khi sang tháng mới; dữ liệu lịch sử được giữ nguyên.

## 6. API đề xuất

Frontend không nên thao tác trực tiếp với Google Sheets. Tất cả request đi qua backend.

### `GET /api/attendance/today`

Mục đích:
- Trả về ngày hiện tại theo múi giờ Việt Nam.
- Trả về danh sách học viên cố định.
- Trả về trạng thái đã lưu/chưa lưu của ngày hiện tại.

Ví dụ phản hồi:

```json
{
  "date": "2026-10-14",
  "saved": false,
  "students": [
    { "id": "SV001", "fullName": "Nguyễn Văn A" },
    { "id": "SV002", "fullName": "Trần Thị B" }
  ]
}
```

### `POST /api/attendance/save`

Mục đích: lưu toàn bộ điểm danh của một ngày.

Ví dụ request:

```json
{
  "date": "2026-10-14",
  "attendance": [
    { "studentId": "SV001", "status": "PRESENT" },
    { "studentId": "SV002", "status": "ABSENT" }
  ]
}
```

Backend phải:
1. Kiểm tra dữ liệu đầu vào.
2. Kiểm tra ngày hợp lệ và thuộc ngày được phép điểm danh.
3. So khớp đầy đủ danh sách ID với danh sách cố định phía backend.
4. Kiểm tra không có ID trùng, thiếu hoặc thừa.
5. Kiểm tra ngày đã lưu chưa.
6. Tạo tab tháng nếu chưa có.
7. Ghi một hàng dữ liệu.
8. Trả kết quả.

Mã lỗi nghiệp vụ tối thiểu:
- `VALIDATION_ERROR`: dữ liệu thiếu/sai.
- `ATTENDANCE_ALREADY_SAVED`: ngày đã được lưu.
- `SHEETS_UNAVAILABLE`: không kết nối/ghi được Google Sheets.
- `INTERNAL_ERROR`: lỗi không xác định.

> Nếu dùng Next.js API Route làm lớp trung gian, cần bảo vệ endpoint và giữ bí mật thông tin xác thực ở biến môi trường phía server. Nếu dùng Google Apps Script Web App, đặt logic kiểm tra, chống trùng và ghi Sheets trong Apps Script; không để frontend có quyền tùy ý đọc/ghi toàn bộ Spreadsheet.

## 7. Bảo mật và độ tin cậy

- Không đưa Google service account private key, OAuth refresh token hoặc bí mật tương tự vào mã frontend.
- Không commit file `.env.local` lên Git.
- Giới hạn endpoint chỉ nhận các thao tác và trường dữ liệu cần thiết.
- Kiểm tra payload ở backend, kể cả khi frontend đã kiểm tra.
- Chống ghi trùng ở backend.
- Tránh ghi nhiều lần khi người dùng bấm nút liên tục.
- Ghi log lỗi kỹ thuật mà không làm lộ bí mật.
- Nếu web được sử dụng công khai, cần bổ sung xác thực người điểm danh hoặc cơ chế bảo vệ endpoint trước khi triển khai thật. “Không cần database” không đồng nghĩa với “không cần bảo vệ API”.

## 8. Cấu trúc thư mục gợi ý

```text
attendance-web/
├─ README.md
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ layout.tsx
│  │  └─ api/
│  │     └─ attendance/
│  │        ├─ today/route.ts
│  │        └─ save/route.ts
│  ├─ components/
│  │  ├─ AttendanceHeader.tsx
│  │  ├─ StudentAttendanceCard.tsx
│  │  ├─ AttendancePagination.tsx
│  │  ├─ AttendanceSummary.tsx
│  │  └─ SaveAttendanceButton.tsx
│  ├─ config/
│  │  └─ students.ts
│  └─ lib/
│     ├─ attendance.ts
│     ├─ date.ts
│     └─ google-sheets.ts
├─ .env.example
└─ package.json
```

Nếu toàn bộ backend được thực hiện bằng Google Apps Script, các API route Next.js có thể chỉ làm lớp trung gian hoặc được bỏ đi tùy cách triển khai; không triển khai hai nơi cùng ghi dữ liệu.

## 9. Biến môi trường

Tạo `.env.example` để mô tả tên biến, không chứa giá trị bí mật thật. Tên cụ thể phụ thuộc phương án tích hợp Google Sheets.

Ví dụ với backend Next.js và Google Sheets API:

```env
GOOGLE_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

Nếu dùng Apps Script Web App:

```env
GOOGLE_APPS_SCRIPT_URL=
GOOGLE_APPS_SCRIPT_TOKEN=
GOOGLE_SPREADSHEET_ID=
```

Không cần khai báo tất cả các biến trên cùng lúc; chỉ dùng nhóm biến tương ứng với kiến trúc đã chọn. Mọi biến bí mật chỉ được truy cập ở server, không dùng tiền tố `NEXT_PUBLIC_`.

### Tích hợp Apps Script trong dự án

Dự án hiện dùng Next.js API Route làm lớp trung gian và Google Apps Script làm backend ghi Sheets. Mã Apps Script ở `apps-script/Code.gs`:

1. Mở Google Spreadsheet, vào **Extensions → Apps Script**, dán nội dung `apps-script/Code.gs` và lưu.
2. Trong Apps Script, mở **Project Settings → Script Properties**, thêm:
   - `ATTENDANCE_API_TOKEN`: một chuỗi bí mật ngẫu nhiên dài; dùng cùng giá trị cho `GOOGLE_APPS_SCRIPT_TOKEN` phía Next.js.
   - `ATTENDANCE_SPREADSHEET_ID`: ID của Spreadsheet; trigger tháng dùng giá trị này.
3. Chọn múi giờ dự án Apps Script là `Asia/Ho_Chi_Minh`.
4. Chạy `installMonthlyTrigger` một lần trong Apps Script và cấp quyền truy cập Spreadsheet.
5. Chọn **Deploy → New deployment → Web app**, chạy dưới tài khoản chủ sở hữu Spreadsheet. Cho phép truy cập Web App và dựa vào token để xác thực request.
6. Sao chép URL kết thúc bằng `/exec` vào `GOOGLE_APPS_SCRIPT_URL`, đặt cùng token vào `GOOGLE_APPS_SCRIPT_TOKEN` và Spreadsheet ID vào `GOOGLE_SPREADSHEET_ID` trong `.env.local`.
7. Khởi động lại Next.js sau khi sửa `.env.local`. Không commit file này.

Apps Script kiểm tra token, ngày, toàn bộ ID/trạng thái học viên, khóa đồng thời khi lưu, chống lưu trùng và tạo tab tháng nếu thiếu. Cấu trúc tab gồm `attendance_date`, `saved_at` và các cột mã `SV001`–`SV088`. Nếu danh sách lớp thay đổi, cần đồng bộ danh sách ID trong `apps-script/Code.gs` với `lib/students.ts`, sau đó cập nhật/redeploy Web App.

`GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_PRIVATE_KEY` chỉ dành cho phương án Google Sheets API trực tiếp; không dùng khi chạy Apps Script. Không điền các biến này trong `.env.example`.

## 10. Tiêu chí nghiệm thu

### UI
- [ ] Desktop hiển thị 10 học viên mỗi trang.
- [ ] Mobile hiển thị 6 học viên mỗi trang.
- [ ] Có phân trang và giữ trạng thái khi chuyển trang.
- [ ] Tên dễ đọc; nút Có mặt/Vắng lớn và rõ.
- [ ] Hiển thị số Có mặt, Vắng và chưa chọn.
- [ ] Mặc định trạng thái học viên là Có mặt; vẫn có thể chọn Vắng trước khi lưu.
- [ ] Có xác nhận trước khi lưu.
- [ ] Sau khi lưu thành công, giao diện khóa chỉnh sửa.
- [ ] Sau khi lưu, vẫn chuyển được trang để xem danh sách.
- [ ] Sau khi lưu, hiển thị danh sách học viên vắng ở cuối trang.

### Nghiệp vụ
- [ ] Danh sách học viên lấy từ cấu hình cố định.
- [ ] Mỗi học viên có đúng một trạng thái.
- [ ] Backend từ chối dữ liệu thiếu, thừa hoặc ID trùng.
- [ ] Mỗi ngày chỉ lưu một lần.
- [ ] Gửi lại request không làm nhân đôi hoặc ghi đè dữ liệu.
- [ ] Lỗi mạng không xóa lựa chọn hiện tại trên giao diện.

### Google Sheets
- [ ] Tạo đúng tab `YYYY-MM`.
- [ ] Lưu mỗi ngày thành một hàng.
- [ ] Hàng có đủ trạng thái của toàn bộ học viên.
- [ ] Tab tháng mới tự động được tạo.
- [ ] Nếu trigger không chạy, lần lưu tiếp theo vẫn tự tạo tab còn thiếu.
- [ ] Dữ liệu tháng trước vẫn được giữ nguyên.

### Bảo mật
- [ ] Không có bí mật Google trong bundle frontend.
- [ ] Backend kiểm tra payload độc lập.
- [ ] Endpoint không cho cập nhật/xóa dữ liệu đã lưu.

## 11. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 1 — UI tĩnh
1. Tạo project Next.js + TypeScript + Tailwind.
2. Khai báo danh sách học viên mẫu.
3. Làm giao diện responsive: 10 người/desktop, 5 người/mobile.
4. Làm chọn trạng thái, phân trang, tổng kết và xác nhận lưu.
5. Kiểm tra tên dài, màn hình nhỏ và thao tác cảm ứng.

### Giai đoạn 2 — Google Sheets
1. Tạo Google Spreadsheet và triển khai `apps-script/Code.gs` theo hướng dẫn trên.
2. Cấu hình URL, token và Spreadsheet ID trong `.env.local`.
3. Kiểm tra quyền truy cập an toàn.
4. Thử trường hợp tải ngày, lưu thành công, lỗi mạng và lưu trùng.

### Giai đoạn 3 — Tự động hóa và triển khai
1. Cấu hình trigger tạo tab tháng.
2. Kiểm tra múi giờ `Asia/Ho_Chi_Minh`.
3. Deploy frontend.
4. Kiểm tra trên điện thoại thật và máy tính.
5. Kiểm tra lại quyền truy cập, biến môi trường và log lỗi.

## 12. Hướng dẫn cho AI khi phát triển dự án

Khi yêu cầu AI viết code:
- Đọc README này trước khi sửa.
- Giữ nguyên nguyên tắc: danh sách cố định, không database, Google Sheets là nơi lưu lịch sử.
- Không thêm đăng nhập, quản lý lớp, sửa tên hoặc chỉnh sửa lịch sử nếu chưa được yêu cầu.
- Không thay đổi cấu trúc sheet hoặc tên cột tùy tiện.
- Không dùng dữ liệu mẫu thay cho danh sách thật khi triển khai.
- Viết TypeScript có kiểu dữ liệu rõ ràng.
- Tách UI, nghiệp vụ và tích hợp Google Sheets.
- Không đưa secret lên frontend hoặc Git.
- Sau mỗi giai đoạn, nêu rõ file đã tạo/sửa, cách chạy và cách kiểm tra.
- Ưu tiên giải pháp ít phụ thuộc, dễ bảo trì và dễ thao tác hơn là thêm nhiều tính năng.

## 13. Các quyết định cần chốt trước khi triển khai thật

- Điền danh sách học viên thật vào `src/config/students.ts`.
- Chọn backend: **Google Apps Script** (thường ít cấu hình hơn) hoặc **Google Sheets API chạy phía server**.
- Chọn cách bảo vệ trang/API: nếu chỉ dùng nội bộ, vẫn cần hạn chế người lạ gọi endpoint; nếu triển khai công khai, nên có xác thực.
- Xác nhận quy tắc “một lần lưu mỗi ngày” có phù hợp với quy trình lớp học hay không.

---

**Phạm vi MVP:** Một lớp, một danh sách cố định, điểm danh ngày hiện tại, hai trạng thái Có mặt/Vắng, phân trang responsive và lưu bất biến vào Google Sheets theo từng tháng.
