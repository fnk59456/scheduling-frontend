# 無期間版本、取消簽核與簽核總表裁決交接

> 更新日期：2026-08-27
> 實作範圍：`scheduling-frontend` + `scheduling-api`

## 功能結論

1. 使用者建立排班版本時不再輸入開始／結束日期。
2. `period_start`、`period_end` 保留為後端內部資料涵蓋範圍：建立版本時以伺服器當日初始化，新增或移動班次時只會自動向外擴張。
3. 相同機構、相同 A/B 軌的不同版本，允許在同一時段排到同一位員工；即使版本分店不同，同一員工仍視為時間衝突。
4. 排班編輯與「簽核」不阻擋跨版本重疊；草稿畫面只顯示目前版本，新增／修改／拖曳後以 toast 提醒，並在目前版本班次右下角保留警告圖示。
5. 已簽核版本的班次為唯讀。取消簽核並填寫原因後，版本回到草稿才可修改。
6. `/schedules/approved` 只拼接已簽核版本，按實際班次起訖時間列出重疊，不再使用版本期間判定衝突。
7. 重疊裁決可選：
   - 保留一或多筆彼此不重疊的班次。
   - 允許全部重疊班次並存；此選項強制填寫備註。

## 前端修改

主要檔案：

- `src/pages/schedules/SchedulesPage.tsx`
- `src/pages/schedules/ApprovalScheduleSummaryPage.tsx`
- `src/pages/schedules/EmployeeMonthScheduleDialog.tsx`
- `src/lib/scheduleOverlap.ts`
- `src/api/endpoints/schedules.ts`
- `src/hooks/useSchedules.ts`
- `src/types/schedule.ts`

排班管理：

- 新增版本表單已移除日期欄位。
- 週曆可無限制左右瀏覽及排班；選取版本的內部資料範圍由 API 自動更新。
- 週班表與個人月班表只呈現目前選取版本的班次，不再把其他版本畫成 combined 班次。
- 其他版本資料只在背景參與跨版本重疊驗證；目前班次若衝突，右下角顯示三角驚嘆號，tooltip 會列出來源版本與班別。
- 新增、修改、拖曳或 combine 後若產生跨版本重疊，操作仍成功並顯示 toast，不會阻止儲存或簽核。
- 草稿顯示「簽核」，已簽核顯示「取消簽核」；兩者共用同一按鈕位置。
- 已簽核版本禁止新增、編輯、刪除、拖曳；取消時必須填寫原因。
- 個人月班表畫面只顯示目前版本；個人 Excel 下載才會依使用者選取範圍，拼接同機構／軌別的所有非封存版本。

簽核總表：

- 路由：`/schedules/approved`
- 支援機構、分店、A/B 軌與週次篩選。
- 一次取得已簽核版本、班次、實際重疊群組與既有裁決。
- 未裁決班次以紅色警告標示。
- 「保留指定班次」可複選，但被保留的班次不可彼此重疊。
- 「允許全部並存」必須填寫備註。
- 裁決後，總表採計工時與班次顯示立即依結果更新。

## 後端修改

主要檔案：

- `apps/schedules/models.py`
- `apps/schedules/serializers.py`
- `apps/schedules/views.py`
- `apps/schedules/urls.py`
- `apps/schedules/overlaps.py`
- `apps/schedules/migrations/0004_scheduleoverlapdecision.py`
- `tests/test_schedule_overlap_workflow.py`

### 版本範圍

- `ScheduleVersionSerializer.period_start`、`period_end` 對 API 輸入為唯讀。
- 未提供日期建立版本時，以 `timezone.localdate()` 初始化兩欄。
- `ScheduleSerializer.create/update` 在班次日期超出既有資料範圍時自動向外擴張，不會自動縮小。
- 這兩欄仍保留，供既有匯出、AI、合規與資料摘要相容使用；不再是瀏覽或排班限制。

### 已簽核鎖定與取消簽核

```http
POST /api/schedules/versions/{id}/unapprove/
Content-Type: application/json

{ "reason": "重新調整臨時請假班次" }
```

- 原因必填。
- 僅 `approved` 可取消；非 approved 回 `409`。
- 使用 transaction + row lock。
- 成功後改為 `draft`，清除 `approved_by`、`approved_at`。
- 原因與欄位變動寫入 `AuditLog(action=cancel)`。
- Schedule 的新增／修改由 serializer 阻擋非 draft 版本；刪除由 view 阻擋並回 `409`。

#### 取消簽核理由的來源與後續變更手順

- 「取消原因必填」是後端工程師交付的原始 `scheduling-api-0820` 契約，不是整合到現行 `scheduling-api` 後才新增的限制。
- 原始與現行後端的 `apps/schedules/views.py::unapprove` 都會拒絕缺少或只有空白的 `reason`，並回傳 `400 { "error": "reason is required" }`。
- 兩套程式也都有 `tests/test_approval_lock_and_unapprove.py::test_unapprove_requires_reason`；現行前端因此保留必填輸入框及 `{ reason }` request body。
- `scheduling-api-0820` 定位為上游參考版本；後續產品若決定取消必填，不要修改此參考目錄，僅修改現行 `scheduling-api` 與 `scheduling-frontend`。

若產品確認取消理由不再必填，交接執行順序如下：

1. 先確認稽核政策：即使沒有理由，仍應保存操作者、時間、舊狀態、`draft` 新狀態及原簽核人／時間。
2. 現行後端移除空白理由的 `400` 驗證；`AuditLog` 的 `changes` 應只在有提供理由時加入 `reason`，不可因此略過整筆取消簽核紀錄。
3. 更新現行後端測試：空 body 與空白 reason 應成功、非 `approved` 仍回 `409`、成功後仍須驗證狀態清除與 AuditLog。
4. 前端 `scheduleVersionsApi.unapprove` 與 `useUnapproveScheduleVersion` 改為不要求 reason，取消簽核 Dialog 移除輸入框，但保留破壞性操作的二次確認。
5. 執行後端取消簽核／鎖定測試、完整前端 build，並以已簽核版本實測「取消 → 回草稿 → 可編輯」。

目前決策：理由仍為必填，以上僅作為未來需求確認後的變更手順，尚未執行。

### 簽核總表 API

```http
GET /api/schedules/versions/approved-timeline/
  ?organization={id}
  &branch={id|all}
  &version_type={actual|legal}
  &date_from=YYYY-MM-DD
  &date_to=YYYY-MM-DD
```

回傳：

- `versions`：符合篩選的 approved 版本。
- `schedules`：區間內班次，並額外納入前一日跨午夜班次。
- `conflicts`：同員工、同機構、同軌、不同版本且實際時間相交的群組。版本分店不同仍會判定，避免同一人跨據點同時上班。
- `unresolved_conflict_count`：尚未保存裁決的群組數。

指定 `branch` 時，以員工目前所屬分店篩選班次，不以版本的 branch 欄位排除；A/B 不同軌與同一版本內的 combine 不屬於此處的跨版本衝突。

### 裁決 API

```http
POST /api/schedules/overlap-decisions/
Content-Type: application/json

{
  "conflict_key": "...",
  "schedule_ids": [101, 205],
  "decision": "select",
  "selected_schedule_ids": [101],
  "comment": ""
}
```

或：

```json
{
  "conflict_key": "...",
  "schedule_ids": [101, 205],
  "decision": "coexist",
  "selected_schedule_ids": [101, 205],
  "comment": "主管確認為支援性重疊紀錄"
}
```

- `conflict_key` 由衝突班次 ID 與 `updated_at` 產生；班次異動後舊裁決不會誤套。
- API 會重新查詢完整衝突群組，拒絕缺少候選班次或過期的請求。
- `select` 至少一筆，且所選班次不得彼此重疊。
- `coexist` 自動採用完整群組且 `comment` 必填。
- 相同 `conflict_key` 再送一次會更新原裁決並更新裁決人與時間。
- 新資料表：`ScheduleOverlapDecision`；migration 已在目前 Docker 環境套用。

## 驗證紀錄

- `npm.cmd run build`：成功。
- 本機畫面以 Alice 2026-07-01 驗證：操作版「2026 07」只呈現自己的日班，沒有把「2026 7~8月」短班畫成 combined；日班 tooltip 仍能指出跨版本衝突來源。
- `pytest -q tests/test_schedule_overlap_workflow.py tests/test_api.py`：51 passed。
- `python manage.py makemigrations --check --dry-run`：No changes detected。
- `python manage.py migrate`：`schedules.0004_scheduleoverlapdecision` 套用成功。

## 後續注意事項

- 目前「所有重疊皆已裁決」是即時計算狀態，沒有額外的整張總表封存／定案模型。
- 若未來需要總表版本、定案後不可改、電子簽章或多層主管核准，需另設 Summary Approval entity 與狀態機，不應塞入單筆重疊裁決。
- 既有 Excel 匯出仍以目前選取版本為來源；若要匯出裁決後總表，應改接 `approved-timeline` 並套用 decision。
