# 後端修改交接說明：排班拖曳功能

> 異動範圍：`apps/schedules/models.py`、`apps/schedules/migrations/0003_*.py`  
> 日期：2026-07

---

## 背景

前端新增了班表格的拖曳功能（移動與交換），上線後發現部分員工的班格在前端顯示為空，但對同一格執行新增或 PATCH 時卻觸發 `unique constraint 400`，確認後端資料庫確實存在該筆記錄。

---

## 根本原因：分頁排序非確定性

### 問題設定

- DRF 分頁設定：`PageNumberPagination`，`PAGE_SIZE = 20`
- 前端使用 `fetchAllPages` 依序拉取所有頁面
- 版本 3（`2026 07 legal`）當週共 42 筆班格

### 觸發條件

`Schedule.Meta.ordering` 原本為：

```python
ordering = ['schedule_date', 'shift_template__start_time']
```

當同一天同班別有多名員工（例如 07-03 日班有 E0001、E0004、E0007 三人），這個 ordering **在同一群組內是非唯一的**——PostgreSQL 可任意決定這三人的先後順序，且每次 SQL 查詢的結果不保證一致。

### 分頁跳格的發生機制

以版本 3 當週為例：

| 日期 | 筆數 | 累計（排序後） |
|------|------|--------------|
| 07-01 | 8 | 1–8 |
| 07-02 | 8 | 9–16 |
| 07-03 大夜班×2 | 2 | 17–18 |
| 07-03 日班×3（E0001／E0004 Diana／E0007） | 3 | **19–21**（跨頁邊界） |
| 07-03 小夜班×3 | 3 | 22–24 |

`PAGE_SIZE=20` 的分頁邊界恰好落在 07-03 日班群組中間（第 20 筆）。

由於群組內排序非唯一，page 1（`OFFSET 0 LIMIT 20`）和 page 2（`OFFSET 20 LIMIT 20`）兩次 SQL 查詢可能對三人採用不同順序，最壞情況：

- Page 1 查詢：Diana 排第 21 → 不在 page 1 回傳
- Page 2 查詢：Diana 排第 20 → 被 OFFSET 20 跳過

**Diana 的班格同時消失在兩頁中**，前端看不到，但資料庫確實存在，因此任何寫入操作都觸發 unique constraint。

---

## 修復內容

### 異動檔案：`apps/schedules/models.py`

```python
class Meta:
    # 修復前（非唯一排序）
    ordering = ['schedule_date', 'shift_template__start_time']

    # 修復後（加上 id 作為確定性 tie-breaker）
    ordering = ['schedule_date', 'shift_template__start_time', 'id']
```

`id` 是唯一值，確保每次查詢對同一批資料永遠產生相同排列，消除跨頁跳格的可能性。

### Migration：`apps/schedules/migrations/0003_fix_schedule_ordering_deterministic.py`

Django `Meta.ordering` 異動需要 migration（`AlterModelOptions`）。已產生並套用。

```bash
# 確認 migration 狀態
docker exec scheduling-api-web-1 python manage.py showmigrations schedules
# 應看到 [X] 0003_fix_schedule_ordering_deterministic
```

---

## 驗證方式

修復後，對版本 3 當週的分頁順序進行驗證：

```sql
-- 確認 Diana（E0004）固定在第 20 筆（page 1 末尾）
SELECT ROW_NUMBER() OVER (ORDER BY s.schedule_date, st.start_time, s.id) AS row_num,
       e.employee_id, s.id, s.schedule_date, st.name
FROM schedules_schedule s
JOIN employees_employee e ON s.employee_id = e.id
JOIN shifts_shifttemplate st ON s.shift_template_id = st.id
WHERE s.schedule_version_id = 3
  AND s.schedule_date BETWEEN '2026-07-01' AND '2026-07-07'
ORDER BY s.schedule_date, st.start_time, s.id
LIMIT 25;
```

預期結果：E0004（Diana）永遠在第 20 行，不再隨查詢順序浮動。

---

## 注意事項

**此問題的通用規則**：所有使用 `PageNumberPagination` 的 Model，`Meta.ordering` 的最後一欄**必須是 unique 欄位**（通常是 `id`）。

其他 Model 的 ordering 若未加 `id`，在資料量超過 `PAGE_SIZE` 時存在相同風險，建議一併檢查：

```bash
# 查看所有 Model 的 ordering 設定
grep -rn "ordering\s*=" apps/*/models.py
```
