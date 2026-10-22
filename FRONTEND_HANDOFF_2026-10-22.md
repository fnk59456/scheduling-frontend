# 前端改動交接文件（2026-10-22）

## 目的與範圍

本次前端配合後端 2026-10-22 API 更新，完成以下五組功能：

1. Email 驗證碼自助註冊。
2. 管理者代建、修改與刪除出勤。
3. 最低人力需求 CRUD。
4. 班表人力覆蓋、國定假日／補班日呈現。
5. 一例一休及其他合規規則的硬性／軟性設定。

實作原則是沿用既有 API client、React Query hooks、權限與 UI 元件，不在前端複製後端工時、異常或勞動法規演算法。

## 開發與執行環境

- 前端：Vite + React + TypeScript。
- 本機網址：`http://127.0.0.1:3000`。
- API：透過 Vite `/api` proxy 連到既有 Docker 後端 `http://127.0.0.1:8000`。
- 本機測試帳號：`admin` / `admin123`。
- 前端容器：沿用既有 `scheduling-frontend`，未另建重複容器。

啟動既有容器：

```powershell
docker restart scheduling-frontend
```

正式建置檢查：

```powershell
npm.cmd run build
```

## 1. Email 驗證碼註冊

### 使用者流程

登入頁新增「登入／註冊」分頁。註冊流程如下：

1. 輸入 Email，取得六位數驗證碼。
2. 按照後端回傳的 `cooldown_seconds` 倒數，倒數結束前不可重送。
3. 本機開發環境若回傳 `debug_code`，直接在表單下方顯示，方便測試。
4. 輸入驗證碼、至少八碼密碼及選填姓名。
5. 註冊成功後儲存 Token，沿用既有登入狀態；新帳號沒有機構時由既有 ProtectedRoute 導向機構 onboarding。

### API

- `POST /api/auth/register/send-code/`
- `POST /api/auth/register/`
- `POST /api/auth/login/`：登入識別值包含 `@` 時送 `{ email, password }`，否則送 `{ username, password }`。

前端會呈現後端驗證訊息；429 回應若包含 `retry_after_seconds`，會同步進入重送倒數。

### 主要檔案

- `src/pages/LoginPage.tsx`
- `src/api/endpoints/auth.ts`
- `src/hooks/useAuth.ts`
- `src/types/auth.ts`

## 2. 管理者代建出勤

### 權限與定位

- 只有 `admin`、`manager`、`supervisor` 顯示「代建出勤」。
- 此功能會直接建立正式出勤紀錄，定位為管理者補登／客戶前期測試工具。
- 目前不包含員工補打卡申請、主管簽核或核准歷程。
- 一般員工仍只使用「上班打卡／下班打卡」。

### 功能

- 選擇同機構在職員工。
- 輸入工作日、完整上下班日期時間，支援跨日班次。
- 新增備註。
- 管理者可修改上下班時間與備註，亦可刪除紀錄。
- `actual_hours`、`anomaly_flag`、`anomaly_reason` 不由前端送值；後端會重新計算工時、遲到、早退、超時與無排班出勤。

### API

- `POST /api/attendance/attendances/`
- `PATCH /api/attendance/attendances/{id}/`
- `DELETE /api/attendance/attendances/{id}/`

建立 payload：

```json
{
  "employee_id": 12,
  "work_date": "2026-10-22",
  "clock_in": "2026-10-22T00:00:00.000Z",
  "clock_out": "2026-10-22T09:00:00.000Z",
  "notes": "管理者代建"
}
```

### 主要檔案

- `src/pages/attendance/AttendancePage.tsx`
- `src/api/endpoints/attendance.ts`
- `src/hooks/useAttendance.ts`
- `src/types/attendance.ts`

## 3. 最低人力需求設定

設定頁新增「最低人力」分頁：`/settings/staffing`。

每筆需求可設定：

- 適用時機：每天、每週固定星期、特定日期。
- 範圍：全機構或指定分店。
- 班別：全日總人數或指定班別。
- 最少人數、選填最多人數、備註。
- `max_staff` 有填時不可小於 `min_staff`。

### API

- `GET /api/shifts/staffing-requirements/`
- `POST /api/shifts/staffing-requirements/`
- `PATCH /api/shifts/staffing-requirements/{id}/`
- `DELETE /api/shifts/staffing-requirements/{id}/`

### 主要檔案

- `src/pages/settings/StaffingRequirementsPage.tsx`
- `src/pages/settings/SettingsPage.tsx`
- `src/App.tsx`
- `src/api/endpoints/shifts.ts`
- `src/hooks/useShifts.ts`
- `src/types/shift.ts`

## 4. 班表人力覆蓋與假日日曆

### 人力覆蓋

執行「合規檢查」後，前端讀取回應中的 `coverage`，顯示在每一天的欄頭：

- 綠色：`ok`，已達標。
- 紅色：`under`，人力不足。
- 橘色：`over`，超過上限。
- `shift_template_id: null` 顯示為「全日」。
- 顯示格式為「已排人數／最低需求人數」。

人力覆蓋由後端依需求規則與班表計算，前端只負責呈現。

### 假日日曆

班表會按照目前可視週期呼叫：

```text
GET /api/compliance/holidays/calendar/?start=YYYY-MM-DD&end=YYYY-MM-DD
```

呈現方式：

- `kind: holiday`：黃色底色及假日名稱。
- `kind: makeup`：藍色底色、名稱後加「補班日」。
- 每週固定機構公休日仍保留原有提示。
- 假日排班不在前端阻擋，由合規檢查回傳 soft violation。

### 主要檔案

- `src/pages/schedules/SchedulesPage.tsx`
- `src/api/endpoints/compliance.ts`
- `src/hooks/useCompliance.ts`
- `src/types/compliance.ts`
- `src/types/schedule.ts`

## 5. 合規規則強度

「系統設定 → 公休與假日」新增規則強度區：

- `max_weekly_hours`
- `max_consecutive_days`
- `min_rest_hours`
- `max_daily_hours`
- `weekly_rest_days`

點選後可在 hard／soft 間切換；前端只更新 `soft_rule_types`，沒有自行計算違規。

一例一休相關違規與 AI 排班拒絕原因沿用既有通用呈現：

- hard：紅色。
- soft：黃色提醒。
- AI `warnings`、`rejected` 照後端文字顯示。

## 驗收結果

- `npm.cmd run build`：通過。
- 前端 proxy 登入：成功。
- API schema：HTTP 200。
- 後端完整 Docker 測試：`510 passed, 1 skipped`。
- `scheduling-frontend`、Web、Celery、PostgreSQL、Redis 容器均正常運行。

Vite 目前仍會提示主 bundle 大於 500 kB；這是既有 bundle 拆分的效能提醒，不影響本次功能與建置成功。

## 後續可擴充項目

1. 員工補打卡申請與主管簽核流程；目前只有管理者直接代建。
2. 出勤匯入與匯出按鈕目前仍是既有介面，未納入本次串接。
3. 最低人力列表若資料量增加，可補伺服器分頁、篩選及啟用／停用快捷操作。
4. 可將大型 Excel 相關套件改為動態載入，降低首頁 bundle 大小。

## 回歸注意事項

- 切換帳號後需確認 React Query cache 已清除，避免顯示前一機構資料。
- 新增或修改出勤時不得傳入計算欄位，必須以 API 回應為準。
- 修改班表後，應重新執行合規檢查才會取得最新 `coverage`。
- `weekly_rest_days` 與假日工資判斷均應留在後端，不要在前端建立第二套規則。
