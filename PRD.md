# Student Association Activity Collection System - Implementation Specification

## 1. Project Overview & Architecture
A web-based internal management and data-collection system tailored for student association officers.
- **Frontend**: React (SPA with `HashRouter` for GitHub Pages deployment).
- **Backend API**: Standalone Google Apps Script (GAS) Web App (separate from the Sheet file).
- **Database (Sheets)**: Google Sheet hosted under **Account A**.
- **Storage (Drive)**: Google Drive folder hosted under **Account B**.
- **Security**: Sensitive environment variables & API URLs stored in GitHub Secrets (`.env`).
- **Notification**: Automated email sent via GAS upon activity submission.

---

## 2. Secrets & Security Control
- **Environment Variables**: Create `.env` locally and configure GitHub Action Secrets for deployment.
  - `REACT_APP_GAS_API_URL`: The deployed Google Apps Script Web App Endpoint.
- **Git Rules**: `.gitignore` MUST strictly include `.env`, `.env.local`, `node_modules`, and build artifacts to prevent leaking API endpoints or sensitive credentials.

---

## 3. Google Services Setup (Cross-Account & Standalone GAS)
1. **Standalone GAS Script**: The GAS code MUST be developed as a standalone script project (not bound inside the Google Sheet) for better version control and maintainability.
2. **Account A (Sheets)**: Hosted database sheet, accessed via `SpreadsheetApp.openById(SHEET_ID)`.
3. **Account B (Drive Storage)**: Root target folder hosted under Account B, explicitly shared with Account A with **Editor permissions**. Accessed via `DriveApp.getFolderById(ACCOUNT_B_FOLDER_ID)`.

---

## 4. Authentication & Roles
Login is validated against a `Users` table/sheet in Account A's Google Sheet (Managed directly in Sheets, no UI needed).

### User Roles & Permissions
1. **DeptHead (部長)**:
   - Create new activities (Self-department only).
   - Edit, update details, upload media, and submit activities assigned to their department.
   - Delete activities of their own department.
2. **Leadership (正/副會長)**:
   - View all activity entries.
   - Create and assign activities to ANY department.
3. **ITDept (網管部)**:
   - View all activity entries.
   - Copy activity introduction (formatted based on `scroll_bar.html`).
   - Copy uploaded photo links formatted as HTML (`<h3>l` structure based on `picture_display.html` using converted **lh3** URL format).
   - Download media/data.
   - Mark activity status as **"Handled / Closed"**.

---

## 5. Lifecycle & Workflow

### Step 1: Creation (Quick Form)
- **Creators**: DeptHead, Leadership, ITDept.
- **Required Inputs at Creation**:
  - Activity Name (Text input)
  - Activity Date or Date Range (Text/Date input, editable later)
  - Target Department (Dropdown select)

### Step 2: Draft / Editing
- Designated department officer accesses the activity item to complete the remaining fields:
  - Location, Activity Intro/Description.
  - Main Visual Image (1 file).
  - Record Photos (3 to 10 files). Each photo MUST require:
    - Caption / Description (< 10 characters).
    - Photographer / Credit Name.
  - Optional links (Album Link, Video Link).

### Step 3: Submission
- Officer clicks "Submit".
- Status changes to `Submitted`.
- System sends an automated email notification via GAS to the IT Department's email address (retrieved from the config cell in Google Sheets).

### Step 4: Processing & Closure (IT Dept)
- IT Officer reviews the submitted content.
- Uses one-click copy features to export formatted text/HTML snippets.
- Manually updates status to `Handled / Closed`.

---

## 6. Data Fields & Dropdown Specifications
The system utilizes predefined dropdown choices for data consistency:
- **Department Options**: Predefined list in dropdown (e.g., 活動部, 學術部, 體育部, 美宣部, 公關部, 網管部, 正副會長).
- **Status Options**: Predefined dropdown (`Draft`, `Submitted`, `Closed`).

---

## 7. Google Drive Folder & File Naming Conventions
- **Target Location**: Shared Folder under Account B.
- **Folder Name**: `[Date ActivityName]`
- **File Naming Rules**:
  - Main Visual: `[Date ActivityName MainVisual].[ext]`
  - Record Photos: `[Date ActivityName Photo_1].[ext]`, `[Date ActivityName Photo_2].[ext]`, etc.

---

## 8. UI / UX & Special Copy Logic
1. **Style Reference**: Match the aesthetic and layout defined in the `style_reference` images located in the project root directory.
2. **Modal & Alert Windows**: 
   - **STRICT REQUIREMENT**: DO NOT use native browser popups (`alert()`, `confirm()`, `prompt()`).
   - All notifications, confirmations, and warnings must use **custom React Modal components** styled consistently with the UI design.
3. **IT Dept Special Copy Tools**:
   - **Copy Introduction**: Converts intro text into the exact HTML structure specified in `scroll_bar.html`.
   - **Copy Pictures (lh3 conversion)**:
     - Extracts the Google Drive File ID from the uploaded file URL.
     - Converts it to the CDN format: `https://lh3.googleusercontent.com/d/FILE_ID`.
     - Embeds the transformed link into the `<h3>l` HTML template structure based on `picture_display.html`.

---

## 9. Frontend Technical Guidelines
- **Router**: `HashRouter` from `react-router-dom` to prevent 404 errors on GitHub Pages reload.
- **HTTP Client**: `axios` or native `fetch` targeting `process.env.REACT_APP_GAS_API_URL`.
- **File Upload**: Send files as Base64 encoded strings inside JSON payload to GAS.