# 排班版本日期與連續日曆導航交接

> 更新日期：2026-08-06
> 本文件取代 2026-07-30 的「版本期間限制與延長」設計。

## 現行規則

排班版本不再由使用者設定起始／結束日期。日曆可以無限制向前、向後瀏覽，草稿版本也可以直接在任意日期新增、移動與 combine 班次。

資料庫既有的 `period_start`、`period_end` 沒有刪除，而是改為系統管理的「資料涵蓋範圍」：

- 新版本建立時以後端伺服器當日初始化。
- 新增或移動班次到範圍外時，後端自動向外擴張。
- API 不接受一般前端指定或修改這兩個欄位。
- 不自動縮小，避免刪除邊界班次時產生昂貴且易競態的重算。
- 欄位暫時保留，以相容 AI 排班、合規檢查、匯出與既有報表。

## 跨版本呈現

相同 organization、相同 A/B 軌的非 archived 版本均可在週班表與個人月班表拼接顯示。版本的 branch 不作為同一員工班次的排除條件，避免跨據點同時上班未被提醒；版本的資料涵蓋範圍也不再決定哪一天「歸屬」哪個版本。

- 有班次就顯示。
- 不同版本在同一日但時段不重疊：正常並列。
- 不同版本、同員工的實際時段重疊：顯示警告，不阻擋排班或簽核。
- 最終裁決在 `/schedules/approved` 進行。
- 已簽核版本唯讀；需先取消簽核才可修改。

## 主要檔案

前端：

- `src/pages/schedules/SchedulesPage.tsx`
- `src/pages/schedules/EmployeeMonthScheduleDialog.tsx`
- `src/lib/scheduleOverlap.ts`

後端：

- `apps/schedules/serializers.py`
- `apps/schedules/views.py`
- `apps/schedules/overlaps.py`

完整取消簽核、總表 API 與裁決資料模型請見 `FEATURE_HANDOFF_APPROVAL_SUMMARY.md`。
