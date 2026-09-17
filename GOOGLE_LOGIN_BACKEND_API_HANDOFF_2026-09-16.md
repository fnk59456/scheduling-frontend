# Google 登入：後端 API 現況、限制與待補情境

更新日期：2026-09-16  
適用基準：後端 `scheduling-api` / Git commit `89637d2`  
閱讀對象：PM、後端工程師、前端工程師、測試人員

## 1. 文件目的

本文件只討論 Google 帳號登入，目的是說明：

1. 現階段後端已提供哪些認證協議。
2. 前端依現有協議能做到什麼程度。
3. 為什麼目前還不能直接把「使用 Google 登入」視為可上線功能。
4. PM 需要確認哪些帳號使用情境。
5. 後端需要補哪些 API、資料規則與安全限制。

## 2. 建議架構

目前系統最適合沿用 Firebase Authentication，不需要讓 Django 自行實作完整 Google OAuth callback：

```text
使用者
  → 前端開啟 Google 登入
  → Firebase Authentication 完成 Google OAuth
  → 前端取得 Firebase ID Token
  → Authorization: Bearer <Firebase ID Token>
  → Django / Firebase Admin 驗證 Token
  → Django 找到已綁定的系統 User
  → 回傳 /api/auth/users/me/
```

責任分工：

- Google：驗證 Google 帳號。
- Firebase Authentication：處理 OAuth、Provider 與 ID Token。
- Django：確認此 Firebase 身分是否有權使用排班系統，並綁定角色、機構、分店與 Employee。
- 前端：啟動登入、保存 Firebase session、攜帶 ID Token，並依 `/users/me/` 回應顯示功能。

## 3. 現階段後端已有內容

### 3.1 Firebase ID Token 驗證

後端已實作 `FirebaseAuthentication`，可接收：

```http
Authorization: Bearer <firebase-id-token>
```

後端目前會：

1. 以 Firebase Admin SDK 驗證 Token。
2. 從 Token 取得 `uid`、`email` 與 `name`。
3. 以 `firebase_uid` 尋找 Django User。
4. 找不到時自動建立 User。
5. 將該 User 設為本次 request 的登入者。

Firebase Admin 憑證支援：

- `FIREBASE_CREDENTIALS_PATH`
- `FIREBASE_CREDENTIALS_JSON`
- Application Default Credentials

正式 Railway 環境建議只使用 `FIREBASE_CREDENTIALS_JSON`，不要依賴暫存檔案路徑。

### 3.2 User 身分欄位

目前 User 已有：

- `firebase_uid`
- `email`
- `role`
- `organization`
- `branch`

`GET /api/auth/users/me/` 另會回傳 `employee_pk` 與 `employee_code`，供前端辨識登入者對應的 Employee 本人。

### 3.3 現有登入 API

```http
POST /api/auth/login/
GET  /api/auth/users/me/
PATCH /api/auth/users/update_profile/
```

`POST /auth/login/` 是帳號密碼取得 DRF Token 的流程，不是 Google OAuth endpoint。

## 4. 前端目前能做到什麼

前端已有：

- Firebase SDK。
- Firebase email/password 登入基礎程式。
- Firebase session 監聽。
- Firebase 模式下自動取得 ID Token。
- API request 自動帶入 `Authorization: Bearer <idToken>`。
- Token 交換成功後呼叫 `/api/auth/users/me/`。
- 依 role、organization、branch、employee_pk 顯示系統功能。

因此，只要補上 Google Provider UI，前端技術上可以透過：

```ts
GoogleAuthProvider
signInWithPopup
// 或 signInWithRedirect
```

取得 Firebase ID Token，再交給現有 Django 驗證機制。

但這只完成「Google 身分驗證」，尚未完成安全的「系統帳號授權與綁定」。

## 5. 目前不能直接上線的原因

### 5.1 雲端目前仍使用 DRF Token

目前部署文件記載：

```env
VITE_AUTH_MODE=token
```

Firebase 認證程式雖已內建，但正式雲端尚未確認已設定 Firebase Admin 憑證，也尚未啟用前端 Google Provider。

### 5.2 第一次登入會自動建立空白 User

目前後端收到有效 Firebase Token、但找不到 `firebase_uid` 時，會自動建立 User。新帳號通常沒有：

- role
- organization
- branch
- Employee 關聯

結果會是 Google 登入成功，但登入者無法正常使用排班、請假或員工功能。

### 5.3 既有帳號不會安全地自動綁定

目前後端只用 `firebase_uid` 尋找 User，不會把相同 email 的既有帳密 User 自動綁定 Google。

可能結果：

```text
原本 User：frank@example.com，已有角色與 Employee
Google 首次登入：相同 email，但 firebase_uid 尚不存在
後端建立第二個無角色 User
```

單純依 email 自動合併也有帳號接管風險，因此需要明確的邀請或綁定流程。

### 5.4 尚未定義誰可以登入

目前未確認：

- 任意 Google 帳號是否都能註冊。
- 是否只允許管理員預先建立的員工。
- 是否限制特定 Google Workspace 網域。
- 外部 Gmail 帳號能否加入。
- 帳號離職／停用後如何立即阻止既有 Token。

### 5.5 Token 安全規則尚未完整定義

需要確認：

- 是否檢查 email 已驗證。
- 是否檢查 Firebase Token revoked 狀態。
- 停用 Django User 時是否拒絕登入。
- Firebase project ID／audience 是否固定為正式專案。
- 前端 popup 被瀏覽器阻擋時是否改用 redirect。

## 6. 建議產品決策

建議採「管理員先建立員工／邀請，使用者再用 Google 綁定」；不建議允許任何 Google 帳號自動建立可用的系統帳號。

### 6.1 建議角色

#### 情境 A：既有員工第一次使用 Google 登入

1. 管理員先建立 User 與 Employee。
2. 系統寄出一次性邀請連結，或顯示待綁定狀態。
3. 員工用指定 Google 帳號登入。
4. 後端確認邀請 email、Google verified email 與組織一致。
5. 將 Firebase UID 綁到既有 User。
6. 保留既有 role、organization、branch 與 Employee。

#### 情境 B：已綁定使用者再次登入

1. Firebase 驗證 Google 帳號。
2. Django 以 firebase_uid 找到 User。
3. 檢查 User 啟用狀態與機構狀態。
4. 回傳 `/users/me/`。

#### 情境 C：未受邀 Google 帳號嘗試登入

後端應拒絕，不自動建立 User：

```json
{
  "code": "account_not_invited",
  "message": "此 Google 帳號尚未受邀使用系統。"
}
```

#### 情境 D：Google email 與邀請 email 不同

後端應拒絕綁定，不能只因使用者持有有效 Google Token 就改綁邀請：

```json
{
  "code": "invitation_email_mismatch",
  "message": "登入的 Google 帳號與邀請帳號不一致。"
}
```

#### 情境 E：員工離職或帳號停用

- Django User 設為 inactive。
- 後端每次 request 都拒絕 inactive User。
- 視風險需求撤銷 Firebase refresh tokens。
- 保留歷史操作與綁定稽核，不直接刪除認證歷程。

#### 情境 F：主管／admin 使用 Google 登入

Google 登入只改變認證方式，不改變權限來源。主管與 admin 仍由後端 User role 決定權限；若需要申請自己的假，仍需另外關聯 Employee。

## 7. 建議後端 API

### 7.1 建立邀請

```http
POST /api/auth/invitations/
Authorization: Token <manager-token>
Content-Type: application/json

{
  "user_id": 123,
  "email": "employee@example.com"
}
```

建議回應：

```json
{
  "id": 88,
  "email": "employee@example.com",
  "status": "pending",
  "expires_at": "2026-09-23T12:00:00+08:00"
}
```

權限要求：

- 只能邀請登入者有權管理之機構內 User。
- invitation token 只保存雜湊，不保存明碼。
- 有效期限、重送與撤銷必須明確。

### 7.2 查詢邀請

```http
GET /api/auth/invitations/{invitation_token}/
```

只回傳前端顯示所需的最少資料，例如機構名稱、受邀 email 與到期時間，不暴露 User、Employee 詳細資料。

### 7.3 綁定 Firebase／Google 身分

```http
POST /api/auth/firebase/link/
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "invitation_token": "one-time-token"
}
```

後端必須：

1. 驗證 Firebase ID Token。
2. 確認 `email_verified == true`。
3. 驗證 invitation 未使用、未撤銷、未過期。
4. 比對 Token email 與 invitation email。
5. 確認該 Firebase UID 尚未綁定其他 User。
6. 確認目標 User 尚未綁定其他 Firebase UID，或要求明確換綁流程。
7. 在 transaction 中保存 firebase_uid 並將 invitation 標為 used。
8. 寫入稽核紀錄。

建議成功回應直接使用完整本人資料：

```json
{
  "user": {
    "id": 123,
    "email": "employee@example.com",
    "role_name": "employee",
    "organization": 1,
    "branch": 3,
    "employee_pk": 45,
    "employee_code": "E0045"
  }
}
```

### 7.4 解除或更換綁定

```http
POST /api/auth/firebase/unlink/
POST /api/auth/firebase/relink/
```

這兩項屬高風險操作，至少需要重新驗證、管理員權限或第二種身分確認，不能只靠目前有效 session 一鍵換綁。

### 7.5 查詢目前帳號

現有 endpoint 可沿用：

```http
GET /api/auth/users/me/
Authorization: Bearer <firebase-id-token>
```

建議補充欄位：

```json
{
  "auth_provider": "google.com",
  "firebase_linked": true,
  "email_verified": true
}
```

前端不應以 email、姓名或員工編號自行猜測 User／Employee 關聯。

## 8. 建議資料模型

### 8.1 AuthInvitation

建議至少包含：

- organization
- target_user
- email_normalized
- token_hash
- status: pending / used / revoked / expired
- expires_at
- invited_by
- used_at
- created_at

### 8.2 Firebase 身分

現階段一位 User 只有一個 `firebase_uid` 可以先沿用。如果未來需要同時綁定 Google、Microsoft 或多個 Provider，建議拆成 `ExternalIdentity`：

- user
- provider
- provider_subject / firebase_uid
- email_at_link_time
- linked_at
- linked_by
- last_login_at

唯一限制應至少包含 `(provider, provider_subject)`。

## 9. 建議錯誤碼

| HTTP | code | 使用情境 |
| --- | --- | --- |
| 401 | `invalid_firebase_token` | Token 無效、過期或 project 不符 |
| 401 | `firebase_token_revoked` | Token 已撤銷 |
| 403 | `email_not_verified` | Google email 尚未驗證 |
| 403 | `account_not_invited` | 沒有可用邀請 |
| 403 | `account_inactive` | 系統帳號已停用 |
| 409 | `invitation_email_mismatch` | Google email 與邀請不符 |
| 409 | `firebase_identity_already_linked` | Firebase UID 已綁到其他 User |
| 409 | `user_already_linked` | 目標 User 已綁其他 Firebase UID |
| 410 | `invitation_expired` | 邀請已過期 |
| 410 | `invitation_already_used` | 邀請已使用 |

建議統一回應：

```json
{
  "code": "account_not_invited",
  "message": "此 Google 帳號尚未受邀使用系統。",
  "details": {}
}
```

## 10. 前端預計流程

### 一般登入

1. 使用者按「使用 Google 登入」。
2. 前端執行 Firebase Google popup／redirect。
3. 取得 Firebase ID Token。
4. 呼叫 `/api/auth/users/me/`。
5. 成功則進入系統。
6. 若回傳 `account_not_invited`，顯示「請聯絡管理員建立帳號」，不在前端自行註冊 User。

### 邀請綁定

1. 使用者開啟邀請連結。
2. 前端查詢 invitation 基本資訊。
3. 使用者以 Google 登入。
4. 前端送 Firebase ID Token 與 invitation token 到 `/auth/firebase/link/`。
5. 後端完成綁定並回傳既有 User profile。
6. 前端重新載入 `/users/me/` 並進入系統。

前端不應保存 Google access token，也不需要把 Google 密碼或 OAuth authorization code 傳給 Django；API request 只使用 Firebase ID Token。

## 11. Firebase 與部署設定

正式啟用前至少需要：

- Firebase Console 啟用 Google Provider。
- 設定正式 Authorized Domains。
- Railway 設定 `FIREBASE_CREDENTIALS_JSON`。
- 前端設定完整 Firebase Web config。
- 前端 `VITE_AUTH_MODE=firebase`。
- CORS 加入正式前端網域。
- 確認 Firebase project ID 與前後端使用同一專案。
- 將 service account JSON 放在 Secret，不提交 Git。
- 保留 Token 模式作為切換期 fallback 時，要明確限制哪些帳號仍可使用。

## 12. 安全要求

- 不接受前端自行送來的 user_id、role、organization 或 employee_pk 作為登入身分。
- 所有身分欄位均由後端既有 User／Employee 關聯取得。
- Google email 必須來自已驗證 Firebase Token，不接受 request body 宣稱的 email。
- 正規化 email 大小寫，但不能只靠 email 直接合併帳號。
- 邀請 token 必須一次性、可撤銷、有期限並以雜湊保存。
- 綁定、換綁、解除綁定、邀請與登入失敗應留下稽核紀錄。
- `is_active=false` 的 User 必須在認證階段被拒絕。
- 高安全需求下應使用 `verify_id_token(..., check_revoked=True)`，並設計相應效能與快取策略。
- 不把 Firebase Admin service account、ID Token 或 invitation token 寫入 log。
- Rate limit 登入、邀請驗證與綁定 endpoint。

## 13. PM 需要回答的問題

1. Google 登入是否只允許管理員預先建立／邀請的帳號？建議是。
2. 是否限制公司 Google Workspace 網域？外部 Gmail 是否允許？
3. 一位員工可以更換 Google 帳號嗎？由誰核准？
4. 管理員建立員工時是否立即寄邀請信？是否允許重送與撤銷？
5. 沒有 email 的既有員工如何完成綁定？
6. email 已被另一個 User 使用時如何處理？
7. 主管／admin 是否也必須使用 Google，或保留帳密 fallback？
8. 離職時是停用登入、解除 Firebase 綁定，還是刪除 Firebase 使用者？
9. 是否需要支援同一人多個 Provider？
10. Google／Firebase 暫時不可用時，是否需要緊急登入機制？誰能使用？

## 14. 建議第一版範圍

第一版建議只做：

1. 管理員先建立 User／Employee。
2. 建立單次邀請。
3. 使用者以邀請 email 的 Google 帳號登入。
4. Firebase UID 綁定既有 User。
5. 後續以 Firebase ID Token 驗證。
6. 停用 User 後立即拒絕 API。
7. 管理員可重送或撤銷尚未使用的邀請。

第一版暫不做：

- 公開 Google 註冊。
- 自動依 email 合併帳號。
- 使用者自行換綁 Google 帳號。
- 多 Provider 綁定。
- Google access token 存取 Calendar、Drive 等額外服務。

## 15. 驗收條件

- 已受邀員工能用正確 Google 帳號綁定並登入。
- 綁定後 `/users/me/` 保留原 role、organization、branch、employee_pk。
- 未受邀帳號不能建立可用 User。
- email 不符、邀請過期、邀請重複使用均有穩定錯誤碼。
- 同一 Firebase UID 不能綁定兩個 User。
- 同一 User 不能在未授權情況下被換綁。
- 停用 User 後，即使 Firebase Token 尚未過期也不能使用 API。
- 跨機構主管不能邀請或綁定其他機構 User。
- Token、service account 與 invitation token 不出現在 log 或 API 回應。
- Google 登入失敗不影響既有 Token 登入，直到 PM 決定正式關閉 fallback。
- 後端提供整合測試涵蓋邀請、綁定、重複綁定、停用與跨機構案例。

## 16. 結論

現階段後端已具備「驗證 Firebase ID Token」的技術基礎，因此不需要重新實作 Google OAuth Server；真正缺少的是系統帳號的邀請、綁定、授權與停用規則。

在這些規則完成前，前端即使加入 Google 登入按鈕，也只能證明使用者擁有某個 Google 帳號，不能安全地判斷他是本系統中的哪位員工、屬於哪個機構或具有什麼權限。
