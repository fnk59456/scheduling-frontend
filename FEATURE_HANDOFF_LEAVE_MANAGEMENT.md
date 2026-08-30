# 請假管理前端實現功能交接手冊

> 更新日期：2026-08-30  
> 前端專案：`scheduling-frontend`  
> 對應後端：現行 `scheduling-api`（已移植 0828 請假 API）

## 一、交付結論

目前已完成「主管端與共用介面」的請假 MVP，並將請假資訊整合到週班表、個人月班表、簽核總表與 Excel 匯出。

員工可以查看自己的申請、狀態、駁回理由、特休餘額及取消 pending 申請；但「員工自行送件」仍刻意停用，等待 `/api/auth/users/me/` 提供可靠的 `employee_pk`。

2026-08-30 UI 調整：

- 移除摘要卡「查詢結果」。
- 移除主管摘要卡「主管代登記／送出即生效」。
- 主管摘要區只保留「待審核、已核准」。
- 一般員工保留「我的待審、已核准、特休剩餘」。
- 多假別餘額面板等待後端提供新 API 後再實作。

## 二、目前產品規則

1. 請假以完整日期區間計算，尚未支援半天或小時。
2. 員工送件為 `pending`，主管以上可核准或駁回；駁回理由必填。
3. 主管代員工登記會由後端立即核准。
4. 核准後，日期範圍內既有班次由後端改為 `status: "leave"`。
5. 主管取消已核准請假時，後端依核准快照還原原班次狀態。
6. 特休超額只顯示警告，不阻擋送件或核准。
7. 手動在核准請假日排班時先警告，但使用者確認後仍可儲存。
8. AI 排班由後端將已核准請假日視為不可排日期。

## 三、角色功能

### 一般員工

已完成：

- 查看自己的請假歷史與狀態。
- 依狀態與日期範圍篩選。
- 查看特休額度、已用與剩餘天數。
- 查看申請事由、審核備註及駁回理由。
- 取消自己的 pending 申請。

暫停：

- 「申請請假」按鈕停用。
- 頁面顯示「員工送件功能等待後端契約」。
- 阻塞原因是登入資訊只有 User PK，沒有 Employee PK；不可用 username、姓名或列表順序猜測對應員工。

### 主管／管理者／系統管理員

已完成：

- 查看同機構請假資料。
- 依員工、狀態與日期範圍篩選。
- 摘要顯示待審核與已核准數量。
- 側欄「請假管理」顯示待審數量 badge。
- 查看申請的受影響班次及該員工特休餘額。
- 核准 pending 申請。
- 填寫理由後駁回 pending 申請。
- 代員工登記請假；送出後由後端自動核准。
- 取消已核准申請。

目前限制：

- 沒有主管「我要請假」的獨立入口。
- 後端會將主管建立的任何申請自動核准，包括替自己建立的情況。
- 沒有指定審核人，現行同機構 supervisor 以上皆可審核。

## 四、頁面與互動

路由：`/leaves`

### 主列表

- 使用 `GET /api/leaves/requests/`。
- 前端會自動讀取所有分頁，避免只顯示前 20 筆。
- 點擊資料列開啟申請明細。
- API 發生錯誤時顯示可讀錯誤狀態，不呈現後端 HTML traceback。

### 主管代登記 Dialog

- 選擇員工、假別、開始日期、結束日期與事由。
- 日期有效時即時呼叫 impact API。
- 選擇特休時呼叫 balance API。
- 顯示範圍內日曆天數、受影響班次及特休餘額警告。
- 送出成功後關閉 Dialog 並刷新請假、餘額及班表快取。

### 審核／明細 Dialog

- 顯示申請狀態、期間、事由、影響班次、特休餘額與審核備註。
- pending 且為主管時顯示核准／駁回。
- 駁回理由為必填。
- 一般員工可取消自己的 pending。
- 主管可取消 approved。

## 五、API 與資料層

主要端點：

```http
GET/POST /api/leaves/requests/
GET       /api/leaves/requests/{id}/
POST      /api/leaves/requests/{id}/approve/
POST      /api/leaves/requests/{id}/reject/
POST      /api/leaves/requests/{id}/cancel/
GET       /api/leaves/requests/impact/
GET       /api/leaves/requests/balance/
```

前端檔案：

- `src/api/endpoints/leaves.ts`：API 封裝與跨分頁讀取。
- `src/hooks/useLeaves.ts`：React Query 查詢、mutation、快取失效與 toast。
- `src/types/leave.ts`：假別、狀態、申請、影響與餘額型別。
- `src/pages/leaves/LeavesPage.tsx`：請假列表、代登記及審核 UI。
- `src/lib/leaveDates.ts`：核准請假日期索引與有效工作班次判斷。
- `src/components/layout/Sidebar.tsx`：入口及待審 badge。
- `src/App.tsx`：`/leaves` 路由。

成功 mutation 會失效：

- `leaves`
- `leaveBalance`
- `schedules`
- `approvedScheduleTimeline`

## 六、班表整合

### 週班表

- `Schedule.status === "leave"` 顯示紫色「請假／原排班別」。
- 若後端沒有產生 Schedule leave row，但日期存在已核准 LeaveRequest，顯示紫色請假 overlay。
- 請假 overlay 在草稿版本仍可點擊建立班次。
- 建立、修改或拖曳到請假日時顯示二次確認。
- 確認後允許繼續排班，普通班次與請假標示並存。
- leave 與 cancelled 不參與一般工時、衝突及重疊計算。

### 個人月班表與簽核總表

- 顯示 Schedule leave row 與 LeaveRequest overlay。
- 請假不計入總工時及排班人數。
- 請假班次不形成跨版本衝突。

### Excel

- 個人與整合班表皆會讀取核准請假。
- 請假日以紫色標示。
- 有原班次時顯示「請假／原排」。
- 沒有 Schedule row 的請假日仍會顯示。
- 請假計為 0 小時，不計排班天數。

## 七、已知限制與後續串接點

1. `/api/auth/users/me/` 缺少 `employee_pk`，員工送件不可啟用。
2. balance API 只支援特休，且單位為天。
3. 病假、事假等只有假別選項，沒有額度／已用／剩餘資料。
4. 小時制尚無 `start_at`、`end_at`、`duration_minutes` 契約。
5. 沒有主管自己的 pending 送件流程。
6. 沒有員工與審核主管的對應關係。
7. 沒有多層、多人或代理審核。
8. 特休超額與重複區間目前不由後端硬性阻擋。

上述功能不可只在前端猜測或自行計算，後續契約見後端需求文件：

`scheduling-api/docs/LEAVE_V2_BACKEND_REQUIREMENTS.md`

## 八、驗證紀錄

- `npm.cmd run build`：通過。
- `pytest -q tests/test_leaves.py`：16 passed。
- 本機主管流程：代員工登記、立即核准、餘額更新、明細取消皆已驗證。
- 本機員工流程：只能查看、顯示特休餘額及送件停用提示已驗證。
- 本機班表流程：請假 overlay、手動排班警告及確認後建立班次已驗證。

## 九、後續前端接手順序

1. 後端 `/me` 提供 `employee_pk` 後，啟用一般員工送件 Dialog。
2. 後端修正主管自請與代登記語意後，新增「我要請假／代員工登記」雙入口。
3. 後端提供多假別餘額後，以假別餘額面板取代目前單一特休卡。
4. 後端提供 assigned approver 後，調整待審 badge 與列表為「分派給我」。
5. 小時制契約完成後，再同步修改表單、班表缺口、工時統計與 Excel。

