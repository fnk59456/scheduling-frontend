# 簽核總表與後端簽核規則交接

> 完成日期：2026-07-31  
> 本次實作範圍：前端簽核總表  
> 後端程式：本次未修改  
> 待後端完成：取消簽核、已簽核資料鎖定、版本重疊規則

## 1. 已完成的前端功能

新增頁面：

```text
/schedules/approved
```

主要檔案：

- `src/pages/schedules/ApprovalScheduleSummaryPage.tsx`
- `src/pages/schedules/SchedulesPage.tsx`
- `src/api/endpoints/schedules.ts`
- `src/App.tsx`

功能：

1. 排班管理的「簽核版本」旁新增「簽核總表」按鈕。
2. 導向獨立唯讀頁面，不再提供排班版本下拉選單。
3. 保留機構、分店、A／B 軌別與週次篩選。
4. 預設顯示 B 實際版，可切換 A 法規版；兩個軌別不混合。
5. 僅讀取 `status=approved` 的版本。
6. 依日期拼接相鄰的已簽核版本。
7. 顯示本週來源版本、已排班員工、本週預計工時與版本衝突日期統計。
8. 班表為唯讀，不提供新增、修改、刪除或拖曳操作。
9. 版本期間交界以分隔線呈現，班次 tooltip 保留來源版本。
10. API 端點封裝新增 `scheduleVersionsApi.listAll()`，避免只讀到 DRF 第一頁。

目前頁面使用既有 API：

```text
GET /api/schedules/versions/?organization={id}&version_type={actual|legal}&status=approved
GET /api/schedules/schedules/?version={id}&date_from={date}&date_to={date}
GET /api/employees/employees/
```

前端會針對本週有交集的每一個已簽核版本分別查詢班次。這適合目前資料量
的 MVP，但版本數增加後建議改用第 6 節的彙總端點。

## 2. 目前簽核總表的重疊防禦行為

目前資料庫與 `approve` action 都沒有禁止版本期間重疊，因此前端採保守
處理：

1. 衝突判定範圍為相同機構、相同 A／B 軌別，且版本狀態皆為 approved。
2. 選擇特定分店時，分店版本與 `branch=null` 的機構版本都可能適用。
3. 選擇全部分店時，版本依員工所屬分店判斷；`branch=null` 視為可套用
   全機構員工。
4. 同一員工、同一天若有兩個以上版本適用：
   - 顯示紅色「版本衝突」。
   - 不顯示任何一個版本的班次。
   - 不使用建立時間、簽核時間或版本 ID 靜默決定勝負。
5. 不同分店的版本同期間存在，不會因日期相同就直接判為衝突；只有同一
   員工實際適用多個版本時才衝突。

後端完成明確規則後，前端可移除部分防禦性分支，但建議保留錯誤提示。

## 3. 後端待辦：取消簽核

建議新增：

```http
POST /api/schedules/versions/{id}/unapprove/
Content-Type: application/json

{
  "reason": "取消原因，建議必填"
}
```

成功回應：

```json
{
  "id": 123,
  "status": "draft",
  "approved_by": null,
  "approved_at": null
}
```

規則：

1. 只有 `status=approved` 可以取消簽核。
2. 權限第一階段可沿用 `IsSupervisor`，若產品需要可再限制為原簽核人、
   manager 或 admin。
3. 使用 transaction 與條件式 update，避免並發重複取消。
4. 取消後改回 `draft`，清除 `approved_by`、`approved_at`。
5. `reason` 必須寫入 AuditLog；不要只存在前端 toast。
6. 非 approved 回傳 `409 Conflict`，權限不足回傳 `403 Forbidden`。

待後端完成後，前端下一階段才新增：

- 已簽核版本旁的「取消簽核」按鈕。
- 顯示版本名稱、期間、簽核人與簽核時間的確認 Dialog。
- 必填取消原因。
- 成功後重新整理版本與簽核總表 query。

## 4. 後端待辦：已簽核版本不可修改

目前 `ScheduleViewSet` 與 `ScheduleSerializer` 沒有阻止修改已簽核版本，
排班管理前端也仍可能開啟班次編輯。

建議後端針對 Schedule 的 POST、PUT、PATCH、DELETE 統一檢查：

```python
schedule_version.status == 'draft'
```

只有草稿版本可變更班次。approved、published、archived 應回傳
`409 Conflict`，並提供穩定錯誤碼，例如：

```json
{
  "code": "schedule_version_locked",
  "error": "Approved schedule versions are read-only."
}
```

取消簽核成功、版本回到 draft 後才重新允許編輯。

另外應將以下 ScheduleVersion 欄位設為 read-only，避免一般 PATCH 繞過
狀態轉換：

- `status`
- `approved_by`
- `approved_at`

狀態只能由 `approve`、`unapprove`、`publish`、`archive` 等專用 action
修改。

## 5. 後端待辦：已簽核版本重疊規則

建議正式規則：

> 相同 organization、相同 branch、相同 version_type 的非 archived
> 已簽核版本，期間不可重疊。

補充：

1. A 法規版與 B 實際版是不同軌，期間相同不構成衝突。
2. 不同分店的版本期間相同不構成衝突。
3. draft 版本允許重疊，方便規劃與 Compare。
4. `branch=null` 的語意必須由後端產品規則確認：
   - 若代表全機構，則應與所有分店版本檢查重疊。
   - 若只代表未指定分店，則只和另一個 `branch=null` 版本衝突。
5. 建議在 `approve` action 的 transaction 內檢查，而不是只靠前端。
6. 若發現重疊，回傳 `409 Conflict`：

```json
{
  "code": "approved_version_overlap",
  "error": "The approval period overlaps another approved version.",
  "conflicts": [
    {
      "id": 456,
      "version_label": "2026 9~10月",
      "period_start": "2026-09-01",
      "period_end": "2026-10-31"
    }
  ]
}
```

既有資料若已存在兩個重疊的 approved 版本，不建議 migration 靜默刪除或
自動挑選。請先列出衝突，讓管理者取消其中一版簽核或調整資料。

## 6. 建議後端彙總端點

版本數增加後，建議提供：

```http
GET /api/schedules/approved-timeline/
    ?organization={id}
    &branch={id|all}
    &version_type={actual|legal}
    &date_from=YYYY-MM-DD
    &date_to=YYYY-MM-DD
```

建議回應：

```json
{
  "versions": [],
  "schedules": [],
  "conflicts": [],
  "uncovered_dates": []
}
```

好處：

- 後端統一 branch=null 與版本重疊語意。
- 避免前端對每個版本發出一個 schedules request。
- 匯出、週班表、個人月班表可共用同一份最終資料。
- 可確保分頁不會造成總表缺班次。

## 7. 建議後端測試

至少新增：

1. draft 版本可簽核。
2. approved 版本不可重複簽核。
3. approved 版本可取消簽核並清空簽核欄位。
4. draft／published／archived 不可呼叫 unapprove。
5. 取消原因寫入 AuditLog。
6. 已簽核版本禁止新增、修改、移動與刪除 Schedule。
7. 取消簽核後重新允許修改 Schedule。
8. 同機構、同分店、同軌的已簽核期間重疊時，approve 回傳 409。
9. A 與 B 同期間可分別簽核。
10. 不同分店同期間可分別簽核。
11. branch=null 依最終產品語意正確判斷。
12. 兩個請求並發簽核重疊版本時，最多只能一個成功。

## 8. 前端驗收

1. 從 `/schedules` 點擊「簽核總表」。
2. 確認導向 `/schedules/approved` 並沿用機構、分店與 A／B 軌。
3. 確認頁面沒有排班版本下拉選單。
4. 確認只顯示 approved 版本班次。
5. 左右切換週次，確認相鄰已簽核版本可連續拼接。
6. 切換 A／B，不得混合兩個軌別。
7. 切換分店，確認員工與來源版本同步變更。
8. 重疊資料顯示紅色衝突，不顯示任一版班次。
9. 確認所有班次格皆為唯讀，沒有指派、編輯與拖曳操作。

