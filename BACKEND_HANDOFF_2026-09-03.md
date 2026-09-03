# 前後端交接：員工刪除、請假、可用性與排班版本類型

更新日期：2026-09-03

## 本次前端行為

### 員工證照

- 沿用現有證照類型與員工多對多關聯。
- 主管先透過 `POST /api/employees/certifications/` 建立證照類型，再透過 `POST /api/employees/employees/{id}/add_certification/` 指派給員工。
- 員工頁透過 `DELETE /api/employees/employees/{id}/remove_certification/` 解除指派。
- 本階段不包含證照字號、期限、附件或員工自行申請／驗證流程。

目前 `/api/employees/certifications/` 使用 `IsManager`，只有 admin／manager 能讀取及建立證照類型；employee 的新增／移除 action 使用 `IsSupervisor`。若產品所稱「主管」也包含 `supervisor` 角色，後端需統一權限，否則 supervisor 無法載入可指派的證照清單。

### 員工可用性

- 前端已改用現有 availability API，不再使用頁面內建示範資料。
- `GET/PATCH /api/employees/employees/{id}/availability/` 負責讀取與更新每週工時、特殊規則。
- `POST/DELETE .../availability/time_slots/` 負責新增與刪除單筆時段。
- 產品目前不使用生效起日／迄日；前端更新設定時會明確送出 `effective_from: null`、`effective_to: null`。

### 排班版本類型

- 合規 AI 排班功能尚未上線，前端暫時不呈現「A／B」或兩種班表概念。
- 一般新增版本仍因現有 API 契約固定送出 `version_type: "actual"`。
- 版本清單與簽核總表目前只查詢 `actual`；`legal` 歷史版本不會出現在這批前端畫面。
- `POST /api/schedules/versions/{id}/check-compliance/` 只顯示檢查結果，前端不再因檢查通過而把版本改成 `legal`。
- `derive-legal` 前端入口暫時隱藏，待「合規 AI 排班」產品規則與 API 完成後再接回。

未來產品名稱預計使用「普通班表」與「合規班表」，不使用 A／B 代號；但在合規 AI 排班上線前，前端不顯示兩種類型。

### 請假功能與後續時數契約

- 前端已使用 `/auth/users/me/` 的 `employee_pk` 啟用本人送件。
- 主管若同時是受雇員工，也必須讓其登入 `User` 關聯到同機構的 `Employee`；有 `employee_pk` 時前端會同時顯示「申請自己的假」與「代員工登記」。未關聯時只能代登記，且前端會顯示資料設定提示。
- 平台型 admin 可以不建立 `Employee`；若 admin 也需要請假，則比照主管建立 `User` 與 `Employee` 關聯，不以角色名稱推測本人員工資料。
- `/api/leaves/balances/` 已用於多假別時數面板；`/api/leaves/settings/` 已用於機構假別額度設定。
- 本階段不接 `request_unit: time_range`，也不在前端建立「全日／時段」兩種請假模式。

產品目標是所有請假都以時段表達，並依員工請假當日的實際班表交集計算請假分鐘數，而不是以固定一天時數或純粹的起訖時間差計算。後端後續契約至少需要明確提供：

- 送件前依員工、日期與起訖時間計算出的實際請假分鐘數。
- 跨多日、跨午夜班別、休息時間及當日無班表時的處理規則。
- 一筆請假與多個班次重疊時的每日／逐班拆解。
- 核准後用於餘額扣除、班表顯示與 AI 避排的同一份計算結果，避免前後端各自推算。

### 建議新增：人員匯報關係與請假簽核流程

`User.employee_pk` 只負責辨識登入者本人，不應拿來表達上下級關係。建議把組織上的「誰管理誰」與請假功能的「這一單由誰簽」拆成兩層，避免日後加入代理主管、多層簽核或其他審批功能時需要重做資料結構。

#### 第一層：人員匯報關係

建議新增 `EmployeeReportingLine`（名稱可依後端慣例調整）：

| 欄位 | 用途 |
| --- | --- |
| `employee` | 被管理的 Employee，例如員工 A 或主管 B |
| `supervisor` | 其上級 Employee，例如主管 B 或大主管 C |
| `relationship_type` | `primary`、`secondary` 或 `acting`（代理） |
| `priority` | 多位可簽主管的順序或優先級 |
| `effective_from` / `effective_to` | 關係生效區間，保留調職與代理期間歷史 |
| `is_active` | 停用關係而不破壞歷史紀錄 |

必要約束：

- `employee` 與 `supervisor` 不可相同，且原則上必須屬於同一機構。
- 同一員工在同一有效期間最多一位 `primary` 主管；可另有多位 `secondary`／`acting` 主管。
- 禁止形成循環關係，例如 A → B → C → A。
- 員工或主管刪除、離職及跨機構調動時，需明確處理仍有效的關係，不能留下孤兒資料。

最低限度管理 API 建議：

```http
GET  /api/employees/employees/{id}/reporting-lines/
POST /api/employees/employees/{id}/reporting-lines/
PATCH /api/employees/reporting-lines/{relationship_id}/
DELETE /api/employees/reporting-lines/{relationship_id}/
```

讀取結果應同時提供主管的 `employee_pk`、員工編號與顯示名稱，並依登入者的機構權限限制資料範圍。前端員工編輯頁可用此 API 設定「直屬主管／其他可簽主管」，不以 `User.role` 自動推測實際上級。

#### 第二層：請假簽核流程

建議由後端在建立請假單時，依匯報關係產生並保存該單的簽核快照，而不是前端直接指定審核者。至少需要：

- `LeaveApprovalStep`：請假單、層級、審核人 Employee、狀態、處理時間、意見。
- 簽核策略：先支援「直屬主管一層」；未來可擴充依假別、請假時數或機構設定增加第二層（例如主管 B 請假交由大主管 C）。
- 多位主管規則需由後端明確定義為任一人通過、全員通過或依序通過，不讓前端自行判斷。
- 申請建立後保留審核路徑快照；後續主管異動不應默默改變已送出的待審單，若需改派應走明確的 reassignment 操作並留下稽核紀錄。
- 審核人不得審核自己的申請。若找不到有效主管，應回傳可辨識的業務錯誤，不可讓請假單永久停在無人可簽狀態。
- 現有「主管代員工登記即核准」先維持；若未來也要簽核，應由機構政策設定，不與本人申請流程混用。

前端所需查詢／操作契約建議：

```http
GET  /api/leaves/requests/?assigned_to_me=true&status=pending
GET  /api/leaves/requests/{id}/approval-route/
POST /api/leaves/requests/{id}/approve/
POST /api/leaves/requests/{id}/reject/
POST /api/leaves/requests/{id}/reassign/   # 僅授權管理者
```

請假列表回應建議直接提供 `can_review`、`current_approval_step` 與 `assigned_approvers` 摘要。前端只依這些欄位顯示操作，不再單靠 `role_name` 判斷任何主管是否都能審核。

第一版可先實作「每位 Employee 一位有效的 primary supervisor + 單層簽核」。資料結構仍採上述可擴充設計，便能自然表達員工 A → 主管 B、主管 B → 大主管 C；多主管與多層政策可在後續逐步啟用。

## 高風險項目：刪除員工

前端已依產品要求在「編輯員工」加入實體刪除按鈕與二次確認，目前直接呼叫：

```http
DELETE /api/employees/employees/{id}/
```

目前後端政策已確定為硬刪除：刪除 Employee 時會一併刪除登入 User 與關聯歷史，包括：

- 排班與其連帶異動資料
- 請假紀錄
- 出勤與加班紀錄
- 契約
- 可用性、偏好時段與個資同意紀錄
- 班別員工優先順序等關聯資料

前端會在刪除前顯示上述範圍與不可復原警告，但依產品決定不要求再次輸入員工編號。

## 後端驗收建議

- 刪除員工後，`Employee`、登入 `User` 與約定的關聯歷史均被一致刪除，不留下孤兒帳號。
- 跨機構或權限不足者不可刪除員工。
- availability 的 `day_of_week: null` 可代表「每天」，新增、讀取、刪除均保持一致。
- 合規檢查不應隱含改寫 `version_type`；班表類型只能由明確的建立／AI 排班流程決定。
- 主管／admin 本人請假帳號若有 Employee 身分，`GET /api/auth/users/me/` 必須穩定回傳其 `employee_pk`；主管不得核准或駁回自己的待審申請。
- 員工 A 建立本人請假時，後端能依有效的 primary reporting line 指派主管 B；主管 B 建立本人請假時，能繼續指派其上級主管 C。
- 非當前審核人即使具有主管角色也不可處理該申請；跨機構人員不可被指派為審核人。
- 主管關係在送件後異動時，既有請假單的簽核快照保持不變；經授權改派時必須留下稽核紀錄。
- 找不到有效審核人、上下級關係循環或主管指向自己時，API 應拒絕操作並回傳明確業務錯誤。
