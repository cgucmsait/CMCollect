# CMCollect (長庚大學中醫系學會活動資料蒐集與管理系統)

<div align="center">

![CMCollect Logo](public/logo.png)

**專為長庚大學中醫學系系學會量身打造的現代化黑金旗艦級活動資料蒐集、管理與系網代碼自動生成系統**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Google Apps Script](https://img.shields.io/badge/Google_Apps_Script-GAS-4285F4?style=for-the-badge&logo=google)](https://developers.google.com/apps-script)
[![License](https://img.shields.io/badge/License-Internal_Use-gold?style=for-the-badge)](#)

</div>

---

## 📖 專案簡介

**CMCollect** 旨在徹底解決系學會活動資料零散、格式不一、系網手動編碼耗時繁瑣等痛點。透過統一的雲端平台，各部門幹部可快速建立活動、填寫簡介、上傳並裁切主視覺與精選紀錄照片；網管部則可透過專屬導出工具，一鍵產出符合系網規範的 HTML 結構與相片輪播代碼，大幅提升會務與宣傳工作效率。

---

## ✨ 核心特色

### 1. 奢華黑金暗黑美學 (Luxury Dark-Gold Aesthetic)
* 專屬設計之黑金太極金屬資料夾 Logo 與全套無框 Favicon。
* 頂級毛玻璃（Glassmorphism）、微金屬光暈與絲滑的微動態過渡。
* 登入、建立活動、提交與結案均配備置中毛玻璃狀態動畫反饋。

### 2. 三方權限分流與活動列表
* **各部部長 (DeptHead)**：
  * 「編輯中活動」：僅限編輯自己部門主辦之活動草稿。
  * 「已提交活動」：提交後轉為唯讀，可檢視網管部處理進度與發佈標記。
* **會本部 / 正副會長 (Leadership)**：
  * 「編輯中活動」：會本部自身籌劃之活動。
  * 「已指派活動」：全盤檢視各部門進行中的活動。
  * 「已提交活動」&「已結案活動」：掌握全系學會歸檔狀況。
* **網管部 (ITDept)**：
  * 「已指派活動」&「已提交活動」&「已結案活動」：掌握所有部門動態。
  * 專屬「網管工具」：一鍵導出系網發佈代碼與多項自訂外部連結。

### 3. 所見即所得視覺化簡介編輯 (WYSIWYG)
* 內建專屬 HTML 富文本編輯器，支援粗體、斜體、底線、刪除線與超連結插入。
* 提供「可視化編輯」與「HTML 源碼」即時切換。
* 自動轉碼並精準包裹至最新 `Scroll_bar.html` 系網滾動框規格。

### 4. 1:1 主視覺動態裁切與相片 CDN 轉換
* 上傳非 1:1 比例之活動主視覺時，自動啟動互動式移動縮放裁切工具。
* 紀錄相片限制 3 ~ 10 張，嚴格校驗 9 字內圖說與攝影者資訊。
* 自動將 Google Drive 檔案轉換為高速穩定的 `lh3.googleusercontent.com` CDN 網址，並生成包含 JS 輪播邏輯的 `picture_display.html`。

### 5. 多項自訂外部連結 (External Links)
* 支援由 Google Sheets 全域設定選單項目（如：線上相簿、回顧影片、其他等）。
* 幹部可動態上下增減多筆連結，網管工具支援單項複製與一鍵複製全部連結。

---

## 🛠️ 技術架構與技術棧

* **前端框架**：[React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
* **路由管理**：[React Router DOM v7](https://reactrouter.com/)
* **圖標庫**：[Lucide React](https://lucide.dev/)
* **樣式系統**：Vanilla CSS 原生自定義設計系統（無 Tailwind 限制，具備極致自定義彈性）
* **後端架構**：Google Apps Script (GAS) 雙引擎架構
  * **主控服務 (Master GAS - Account A)**：負責 Sheets 資料庫讀寫、使用者鑑權與 Email 通知。
  * **儲存服務 (Storage GAS - Account B)**：負責 Google Drive 活動資料夾自動建置、圖片 Base64 直傳與原圖保存。

---

## 🚀 快速開始

### 本機環境需求
* Node.js >= 18.0.0
* npm >= 9.0.0

### 安裝與啟動
```bash
# 1. 複製專案庫
git clone https://github.com/YourOrg/CMCollect.git
cd CMCollect

# 2. 安裝相依套件
npm install

# 3. 配置環境變數
# 建立或編輯 .env 檔案，填入您的 GAS Web App API 網址
echo "VITE_GAS_API_URL=https://script.google.com/macros/s/您的_WEB_APP_ID/exec" > .env

# 4. 啟動本機開發伺服器
npm run dev

# 5. 生產環境打包編譯
npm run build
```

---

## 📚 系統部署與維護手冊

完整的 Google Sheets 資料表結構規範、雙 GAS 帳號隔離架構部署、GitHub Actions 自動化發佈與安全性設定，請參閱：
* 📖 **[CMCollect 系統部署與維護手冊 (maintain.md)](maintain.md)**

---

## 🔒 著作權與使用聲明

本系統僅供**長庚大學中醫學系系學會**內部業務管理與活動歸檔使用。
