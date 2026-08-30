# 請假系統 V2：後端修改與對應功能需求

> 更新日期：2026-08-30  
> 文件性質：後續開發需求，本文內容尚未實作  
> 現況基準：`scheduling-api` 全日假、單層主管審核、特休天數制

## 一、修改目的

現行 API 已能完成主管代登記、單層核准／駁回、取消還原班次、特休天數與 AI 排班避開請假日。下一階段需要補足企業實際使用所需的身分對應、多假別餘額、主管自行請假、指定審核人與小時制。

目標不是只增加畫面欄位，而是讓以下資料由後端成為唯一可信來源：

- 登入 User 對應哪一筆 Employee。
- 每一種假別可用、已用及剩餘多少。
- 申請是本人送件還是主管代登記。
- 此申請應由誰審核、目前輪到誰。
- 部分時段請假與班次重疊多少分鐘。

## 二、P0：登入身分提供 Employee PK

### 欲加入功能

一般員工與具有 Employee 身分的主管登入後，前端能直接取得自己的 Employee PK，不再用 username、姓名或員工列表猜測。

### 契約建議

擴充：

```http
GET /api/auth/users/me/
```

建議回傳：

```json
{
  "id": 12,
  "username": "alice",
  "role_name": "employee",
  "organization": 3,
  "organization_name": "Demo Care Center",
  "branch": 5,
  "branch_name": "Taipei",
  "employee_pk": 98,
  "employee_code": "E0001"
}
```

規則：

- User 有 `employee_profile` 時回傳 PK 與員工編號。
- 沒有 Employee profile 時回傳 `null`，不可回傳猜測值。
- 建議同時保留 organization／branch 的 PK 與名稱，避免前端只能使用顯示名稱。

### 對應前端功能

- 啟用一般員工「申請請假」。
- 自動帶入本人，不顯示員工選擇器。
- 主管「我要請假」可識別本人 Employee。
- balance、impact 與歷史查詢可使用可靠 PK。

## 三、P0：區分本人申請與主管代登記

### 現況問題

現行 `create()` 只要呼叫者是 supervisor 以上，就會立即自動核准；即使主管替自己建立，仍會自動核准。

### 欲加入功能

- 員工本人申請：建立 `pending`。
- 主管本人申請：比照一般員工建立 `pending`。
- 主管替其他員工代登記：依現行決策自動核准。
- 申請人不可核准自己的申請。

### 建議判斷

```text
target_employee.user == request.user
  => self submission, pending

target_employee.user != request.user and requester is supervisor+
  => on-behalf submission, auto-approved
```

建議在 LeaveRequest 增加或明確回傳：

```text
submission_source: self | manager_proxy | system
```

不可只用 `created_by != employee.user` 在前端推導，來源應由後端保存。

### 對應前端功能

- 主管頁提供「我要請假」與「代員工登記」兩個入口。
- 自請顯示送審狀態；代登記顯示立即生效提示。

## 四、P1：可配置假別與多假別餘額

### 現況問題

- 10 種假別寫死在 Model choices。
- 只有特休有餘額。
- 特休級距寫死在 `apps/leaves/annual.py`。
- 其他假別沒有額度、已用與剩餘。
- 現行單位為日曆天。

### 欲加入功能

機構可設定適用假別、計算單位與額度規則；前端能一次取得員工所有假別的餘額面板。

### 建議資料模型

#### LeaveTypePolicy

```text
organization
code
display_name
unit: day | hour | minute
minimum_increment_minutes
entitlement_source: statutory | fixed | manual | unlimited
default_entitlement_minutes
allow_overdraft
requires_attachment
is_active
sort_order
effective_from / effective_to
```

#### LeaveBalanceLedger

```text
employee
leave_policy
effective_date
delta_minutes
reason
source_type
source_id
created_by
created_at
```

建議以帳本保存加發、使用、取消、結轉與人工調整，不要只從 LeaveRequest 即時計算所有假別。

### API 建議

```http
GET /api/leaves/balances/me/
GET /api/leaves/balances/?employee={employee_pk}&as_of=YYYY-MM-DD
```

回傳示意：

```json
{
  "employee": 98,
  "as_of": "2026-08-30",
  "balances": [
    {
      "leave_type": "annual",
      "leave_type_display": "特休",
      "unit": "minute",
      "entitled_minutes": 4800,
      "used_minutes": 960,
      "pending_minutes": 240,
      "remaining_minutes": 3840,
      "allow_overdraft": false
    }
  ]
}
```

即使畫面顯示天或小時，建議 API 以整數分鐘作為運算基準，避免浮點小時誤差。

### 對應前端功能

- 請假首頁顯示多假別餘額面板。
- 申請表依假別顯示剩餘、最小單位與超額規則。
- 審核者在同一視窗看到該假別完整額度，而非只看特休。

## 五、P1：小時制與部分班次請假

### 欲加入功能

支援遲到、早退、半天、跨午夜及班次部分區間請假，並精確計算與排班重疊的分鐘數。

### 契約建議

LeaveRequest 新增：

```text
start_at: DateTimeField
end_at: DateTimeField
duration_minutes: PositiveIntegerField
timezone
request_unit: full_day | time_range
```

POST 示意：

```json
{
  "employee": 98,
  "leave_type": "annual",
  "start_at": "2026-09-01T13:00:00+08:00",
  "end_at": "2026-09-01T17:00:00+08:00",
  "reason": "家庭事務"
}
```

後端負責計算並回傳 `duration_minutes`；前端送入的時數不可作為最終可信值。

### impact API

impact 回傳除了班次列表，應增加：

```json
{
  "affected_count": 1,
  "overlap_minutes": 240,
  "daily_breakdown": [
    {
      "date": "2026-09-01",
      "scheduled_minutes": 480,
      "leave_minutes": 240
    }
  ]
}
```

### 班表處理

- 部分請假不可直接把整筆 Schedule 改成單一 `status="leave"`。
- 建議 Schedule 保留原班次，另以 LeaveRequest interval 覆蓋缺勤區間。
- API 應回傳班次與請假交集，供週班表、月班表、合規與 Excel 使用。
- AI solver 應把該時間區間設為不可排，而不是封鎖整天。

### 相容策略

- 舊資料的 `start_date/end_date` 需有遷移或相容序列化策略。
- 可先保留 `full_day`，以機構時區轉換成每日完整工作區間。
- 不建議前端自行把一天固定換算為 8 小時，因為員工契約與班次長度可能不同。

## 六、P1：指定審核人與審核流程

### 現況問題

目前沒有「員工 A 的審核人是主管 B、C」。同機構任何 supervisor 以上都能查看並處理任何 pending 申請；`reviewed_by` 只記錄最後實際處理人。

### 欲加入功能

- 每位員工可設定一或多位審核人。
- 待審 API 只回傳指派給登入者的工作。
- 支援主管自行請假時向上級送審。
- 保存每一步的決定、理由、時間與代理關係。

### 建議資料模型

#### EmployeeLeaveApprover

```text
employee
approver
priority
is_backup
effective_from / effective_to
```

#### LeaveApprovalStep

```text
leave_request
step_order
assigned_approver
status: pending | approved | rejected | skipped
decided_by
decided_at
note
```

### API 建議

```http
GET  /api/leaves/requests/?assigned_to=me&status=pending
GET  /api/leaves/requests/{id}/approval-steps/
POST /api/leaves/requests/{id}/approve/
POST /api/leaves/requests/{id}/reject/
```

approve／reject 必須確認目前使用者是該申請的有效審核人，不可只判斷角色名稱。

### 對應前端功能

- 側欄 badge 顯示「分派給我的待審」。
- 主管頁分成「我的申請」與「待我審核」。
- 明細顯示審核進度與每一步紀錄。

## 七、P1：資料範圍與權限

需確認並實作：

- 主管只能查看自己分店、指定部門，或全機構。
- 跨分店支援主管是否能代登記及審核。
- Admin 是否可覆核或取消所有狀態。
- 主管不可核准自己的申請。
- Employee PK、LeaveRequest PK 與 approver mapping 均須後端驗證，不能信任前端傳入角色。

## 八、P2：驗證、稽核與例外

建議補充：

- 重疊請假申請檢查。
- 相同請求的 idempotency，避免重複點擊建立兩筆。
- 超額採禁止、警告或允許負數的機構設定。
- pending 是否預扣餘額。
- 取消 approved 是否需要再次審核。
- 駁回、取消與餘額調整完整 AuditLog。
- 假別附件與證明文件的檔案契約。
- 休職、離職、未到職期間不得申請的規則。
- 日期／時間輸入使用機構時區。

## 九、產品規則待確認

開始開發 P1 前需要產品決策：

1. 各假別計算單位與最小請假單位。
2. 一日如何換算分鐘：固定工時、員工契約或當日排班。
3. 午休與不計薪休息是否扣除。
4. 無排班日、國定假日與例假日是否計入。
5. 跨午夜班次如何拆日與扣額度。
6. 多審核人採任一通過、依序通過或全數通過。
7. 無直接主管、主管請假或主管缺席時的 fallback。
8. 主管代登記是否永遠自動核准。
9. 特休與其他假別超額是否阻擋。
10. 餘額採週年制、曆年制或機構自行選擇。

## 十、建議開發順序

1. `/auth/users/me/` 增加 `employee_pk`。
2. 修正本人申請與主管代登記的判斷，禁止自我核准。
3. 建立審核人 mapping 與 assigned-to-me 查詢。
4. 建立可配置 LeaveTypePolicy 與多假別 balance API。
5. 產品確認小時制規則後，再遷移 LeaveRequest 時間欄位。
6. 更新 impact、班表、AI solver、合規及 Excel 契約。
7. 最後才移除舊全日假相容欄位。

## 十一、後端驗收條件

### 身分

- `/me` 對 Employee 帳號回傳正確 `employee_pk`。
- 無 Employee profile 時明確回傳 `null`。

### 送件來源

- 員工及主管本人送件皆為 pending。
- 主管替其他員工代登記才會自動核准。
- 任何人都不能核准自己的申請。

### 餘額

- 一次回傳所有啟用假別的額度、已用、pending 與剩餘分鐘。
- 核准、取消及人工調整會留下帳本紀錄。
- 超額行為依機構政策一致執行。

### 審核

- 只有被指派的有效審核人能處理申請。
- B／C 多審核人行為符合已確認規則。
- 所有決定保留操作者、時間與理由。

### 小時制

- 後端正確處理部分班次、跨午夜與休息時間。
- impact、餘額、AI solver、班表及 Excel 使用相同分鐘結果。
- 舊全日假資料可正常讀取。

## 十二、前端串接交付物

後端完成每個階段時，請同步提供：

- OpenAPI schema。
- request／response 範例。
- 權限矩陣。
- 錯誤碼與 400／403／409 使用情境。
- migration 與舊資料相容說明。
- 測試帳號：一般員工、具 Employee profile 的主管、審核主管、代理主管。
- 至少涵蓋本人送件、代登記、超額、多人審核、部分時數、跨午夜與取消還原的自動測試。

