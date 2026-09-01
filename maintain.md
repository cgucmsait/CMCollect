# CMCollect 系統部署與維護手冊 (maintain.md)

本手冊為長庚大學中醫系學會 **CMCollect（活動資料蒐集與管理系統）** 的完整部署、運作與維護指南。說明如何將前端網頁工具對接至 Google Sheets（關聯資料庫）與 Google Drive（檔案儲存庫），並透過 Google Apps Script (GAS) 完成雲端自動化流程。

---

## 1. Google Sheets 資料庫架構 (Account A)

請在 **Account A** 建立一個 Google Sheet，並記錄其網址中的 **Sheet ID**（網址中 `/d/` 與 `/edit` 之間的那串英數字）。在該試算表中建立以下 4 個工作表（名稱大小寫需完全一致）：

### 工作表 1：`Users` (幹部權限帳號表)
此表用於登入驗證與三方權限分流，由管理員直接維護：

| 欄位名 (第一列) | 說明 |
| :--- | :--- |
| `username` | 登入帳號 / 學號 (登入主要識別) |
| `password` | 密碼 (明文或自訂雜湊) |
| `name` | 幹部姓名 (例如：會長大德、活動部小明) |
| `role` | 權限角色。必須精確為以下三者之一：<br>- `DeptHead` (各部部長：僅能查看、編輯、提交自己部門的活動)<br>- `Leadership` (會本部/正副會長：可查看與指派所有部門活動，可編輯會本部自身活動)<br>- `ITDept` (網管部：可查看所有部門活動，使用網管導出工具並標記結案) |
| `department` | 所屬部門。需與活動主辦部門對應（如：會本部、活動部、學術部、體育部、美宣部、公關部、網管部） |

* 範例資料：
  | username | password | name | role | department |
  | :--- | :--- | :--- | :--- | :--- |
  | `113001` | `pwd123` | `小明` | `DeptHead` | `活動部` |
  | `113002` | `pwd123` | `網管小編` | `ITDept` | `網管部` |
  | `113003` | `pwd123` | `會長大人` | `Leadership` | `會本部` |

---

### 工作表 2：`Activities` (活動主表)
手動建立第一列欄位名：
`id`, `name`, `date`, `department`, `location`, `intro`, `mainVisualId`, `albumLink`, `videoLink`, `externalLinks`, `status`, `folderId`, `createdAt`, `updatedAt`

* **欄位注意事項**：
  * `date`：支援單日（`YYYY-MM-DD`）或區間（`YYYY-MM-DD ~ YYYY-MM-DD`）。
  * `intro`：儲存視覺化富文本編輯器產出的 HTML 內容。
  * `externalLinks`：儲存多個自訂外部連結之 JSON 字串（如：`[{"id":"link_1","type":"線上相簿","url":"https://..."}]`）。同時系統相容舊有 `albumLink` 與 `videoLink`。
  * `status`：狀態流為 `Draft`（編輯中/已指派） &rarr; `Submitted`（已提交，一般幹部轉為唯讀） &rarr; `Closed`（網管部已完成系網發佈並結案歸檔）。

---

### 工作表 3：`RecordPhotos` (活動紀錄相片表)
手動建立第一列欄位名：
`photoId`, `activityId`, `fileId`, `caption`, `photographer`, `createdAt`

* 每筆活動限制上傳 3 ~ 10 張紀錄照片。
* 圖說 `caption` 限制 9 字以內（符合系網版型）。

---

### 工作表 4：`Config` (全域設定表)
手動建立第一列欄位名：`Key`, `Value`。並維護以下設定：

| Key | Value 範例 | 說明 |
| :--- | :--- | :--- |
| `IT_EMAIL` | `it-dept@mail.cgu.edu.tw` | 幹部提交活動時，GAS 自動發送審核通報郵件至此信箱 |
| `ACCOUNT_B_FOLDER_ID` | `1A2b3C4d5E...` | Account B 雲端硬碟根目錄資料夾 ID |
| `LINK_TYPES` | `線上相簿,回顧影片,其他` | 活動外部連結下拉式選單之預設選項（逗號分隔） |

---

## 2. 後端 GAS 部署架構選擇

### 方案一：單 Apps Script 共享部署 (簡易部署)
由 **Account B** 部署單一 GAS 腳本，Account A 將 Google Sheet 授權共用給 Account B（編輯者）。
* 指令碼檔案：[`gas/code.js`](file:///c:/Users/IkyuS/Desktop/CMCollect/gas/code.js)

### 方案二：雙 Apps Script 協同上傳 (推薦：帳號與資料庫最高安全隔離)
* **步驟 1（Account B - 儲存服務）**：
  1. 登入 Account B，部署 [`gas/code_b_storage.js`](file:///c:/Users/IkyuS/Desktop/CMCollect/gas/code_b_storage.js)。
  2. 設定共同的 `SECRET_TOKEN`。
  3. 部署為 Web App（執行身分：我，存取權限：任何人），取得 **GAS B API URL**。
* **步驟 2（Account A - 主控服務）**：
  1. 登入 Account A，部署 [`gas/code_a_master.js`](file:///c:/Users/IkyuS/Desktop/CMCollect/gas/code_a_master.js)。
  2. 設定 `DB_ID`、`STORAGE_SERVICE_URL`（填入 GAS B URL）、`SECRET_TOKEN`。
  3. 部署為 Web App（執行身分：我，存取權限：任何人），取得 **GAS A API URL**（即前端所需的 API 網址）。

---

## 3. 網管部系網發佈工具專案規範

網管部人員在活動狀態為 `Submitted` 時，可點擊「網管工具」進入專屬面板：

1. **基本資料一鍵複製**：
   * 活動名稱、地點、活動日期均配備獨立快速複製按鈕，點擊提供即時綠色回饋。
2. **外部連結 (External Links)**：
   * 條列所有自訂連結，支援單項複製網址及「複製全部連結」。
3. **活動簡介 HTML (Scroll_bar)**：
   * 系統已將富文本簡介自動包裹進最新 `Scroll_bar.html` 格式（包含 `width: 100%; height: 100%; overflow: auto; font-family: 'Libre Baskerville', serif; font-size: 20px; word-break: break-word;` 與標準段落 `<p dir="ltr"><span>` 樣式），點擊一鍵複製即可直接嵌入系網。
4. **紀錄照片輪播 HTML (picture_display)**：
   * 自動將 Google Drive File ID 轉換為高速穩定之 **`lh3.googleusercontent.com` CDN 網址**，並注入包含完整結構與 JS 輪播代碼之系網輪播範本。
5. **雲端檔案下載**：
   * 直連對應 Google Drive 資料夾，支援一鍵打包下載全部原圖。
6. **標示為已結案 (Closed)**：
   * 網管人員更新系網完成後點擊結案，跳出專屬毛玻璃載入視窗，狀態變更為 `Closed` 並存檔，各部門在列表將顯示「網管部已完成發佈」。

---

## 4. 前端環境變數與本機開發

### 環境變數設定 (`.env`)
```bash
VITE_GAS_API_URL=https://script.google.com/macros/s/您的_WEB_APP_ID/exec
```

### 本機開發與建置
```bash
# 安裝相依套件
npm install

# 啟動本機開發伺服器
npm run dev

# 生產環境打包編譯
npm run build
```

---

## 5. GitHub Pages 自動化發佈與安全性防護

### `.gitignore` 安全規範
本專案已在 `.gitignore` 中嚴格排除以下檔案，避免外洩或干擾版控：
* `.env`（正式環境金鑰與 API URL）
* `Scroll_bar.html`、`picture_display.html`、`style_reference.png`（本地參考模板）
* `*.py`（離線 Logo 處理腳本）
* `favicon.jpg`、`favicon_rbg.png` 及相關中介圖檔

### GitHub Actions 自動部署設定
在 GitHub 倉庫的 **Settings > Secrets and variables > Actions** 中建立 Secret：
* `VITE_GAS_API_URL`：填入 GAS Web App 正式 URL。
Workflow 將在建置前安全注入環境變數並自動輸出至 `gh-pages` 分支。
