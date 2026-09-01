// CMCollect - Google Apps Script (GAS_A - 資料庫與主控邏輯)
// 部署帳號：Account A (資料庫 Sheets 擁有者)
// 部署設定：網頁應用程式，執行身分選擇「我(Account A)」，存取權限為「任何人」。
// 作用：處理前端的所有請求（登入、活動清單、Sheet 資料寫入），並在需要進行 Drive 操作時，呼叫 Account B 部署的儲存微服務。

const DB_ID = "YOUR_GOOGLE_SHEET_ID_HERE"; // 請替換為 Account A 的 Google Sheet ID
const STORAGE_SERVICE_URL = "YOUR_ACCOUNT_B_GAS_WEB_APP_URL_HERE"; // 請替換為 Account B 部署的 API URL
const SECRET_TOKEN = "CHOOSE_A_SECURE_TOKEN_HERE"; // 請設定與 Storage 腳本一致的安全金鑰

function getDb() {
  return SpreadsheetApp.openById(DB_ID);
}

// 輔助函式：確保日期格式為乾淨的 YYYY-MM-DD 或 YYYY-MM-DD ~ YYYY-MM-DD，防範 Sheets 自動轉 Date 或 ISO 8601 時間字串
function formatDateString(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    const tz = Session.getScriptTimeZone() || "Asia/Taipei";
    return Utilities.formatDate(dateVal, tz, "yyyy-MM-dd");
  }
  let str = dateVal.toString().trim();
  if (str.indexOf("~") !== -1) {
    const parts = str.split("~").map(function (s) { return formatDateString(s.trim()); });
    return parts[0] === parts[1] || !parts[1] ? parts[0] : parts[0] + " ~ " + parts[1];
  }
  if (str.indexOf("T") !== -1 || str.indexOf("Z") !== -1) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const tz = Session.getScriptTimeZone() || "Asia/Taipei";
        return Utilities.formatDate(d, tz, "yyyy-MM-dd");
      }
    } catch (e) { }
  }
  return str;
}

// 呼叫 Account B 儲存空間微服務的輔助函式
function callStorageService(action, payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      token: SECRET_TOKEN,
      action: action,
      payload: payload
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(STORAGE_SERVICE_URL, options);
  const resText = response.getContentText();
  const resData = JSON.parse(resText);
  if (resData.status === "error") {
    throw new Error("儲存微服務錯誤: " + resData.message);
  }
  return resData;
}

// CORS 回傳設定
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonResponse({ status: "success", message: "CMCollect Master Service (GAS_A) is running." });
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "No payload provided." });
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};

    switch (action) {
      case "login":
        return handleLogin(payload);
      case "getActivities":
        return handleGetActivities(payload);
      case "createActivity":
        return handleCreateActivity(payload);
      case "updateActivity":
        return handleUpdateActivity(payload);
      case "deleteActivity":
        return handleDeleteActivity(payload);
      case "updateStatus":
        return handleUpdateStatus(payload);
      default:
        return jsonResponse({ status: "error", message: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ==========================================
// 1. 身份驗證與登入
// ==========================================
function handleLogin(payload) {
  const { username, password } = payload;
  if (!username || !password) {
    return jsonResponse({ status: "error", message: "帳號與密碼為必填。" });
  }

  const db = getDb();
  const sheet = db.getSheetByName("Users");
  if (!sheet) {
    return jsonResponse({ status: "error", message: "找不到 Users 工作表。" });
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === username.toString().trim()) {
      if (data[i][1].toString().trim() === password.toString().trim()) {
        return jsonResponse({
          status: "success",
          user: {
            username: data[i][0],
            name: data[i][2],
            role: data[i][3],
            department: data[i][4]
          }
        });
      } else {
        return jsonResponse({ status: "error", message: "密碼錯誤。" });
      }
    }
  }

  return jsonResponse({ status: "error", message: "找不到該帳號。" });
}

// ==========================================
// 2. 獲取活動列表
// ==========================================
function handleGetActivities(payload) {
  const { role, department } = payload;
  const db = getDb();

  const actSheet = db.getSheetByName("Activities");
  const photoSheet = db.getSheetByName("RecordPhotos");

  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }

  const actData = actSheet.getDataRange().getValues();
  const activities = [];

  let photos = [];
  if (photoSheet) {
    const photoData = photoSheet.getDataRange().getValues();
    for (let i = 1; i < photoData.length; i++) {
      photos.push({
        photoId: photoData[i][0],
        activityId: photoData[i][1],
        fileId: photoData[i][2],
        caption: photoData[i][3],
        photographer: photoData[i][4]
      });
    }
  }

  for (let i = 1; i < actData.length; i++) {
    const actDept = actData[i][3];
    if (role === "DeptHead" && actDept !== department) {
      continue;
    }

    const actId = actData[i][0];
    const actPhotos = photos.filter(p => p.activityId === actId);

    let extLinks = [];
      if (actData[i][14]) {
        try {
          extLinks = JSON.parse(actData[i][14]);
        } catch (e) { }
      }
      if (!extLinks || extLinks.length === 0) {
        if (actData[i][7]) extLinks.push({ id: "link_album", type: "線上相簿", title: "線上相簿", url: actData[i][7] });
        if (actData[i][8]) extLinks.push({ id: "link_video", type: "回顧影片", title: "回顧影片", url: actData[i][8] });
      }

      activities.push({
        id: actData[i][0],
        name: actData[i][1],
        date: formatDateString(actData[i][2]),
        department: actDept,
        location: actData[i][4],
        intro: actData[i][5],
        mainVisualId: actData[i][6],
        mainVisualRawId: actData[i][13] || "",
        albumLink: actData[i][7],
        videoLink: actData[i][8],
        externalLinks: extLinks,
        status: actData[i][9],
        folderId: actData[i][10],
        createdAt: actData[i][11],
        updatedAt: actData[i][12],
        recordPhotos: actPhotos
      });
    }

    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let departments = ["會本部", "活動部", "教學部", "國事部", "藥園部", "體器部", "學術部", "公關部", "美宣部", "醫改部", "網管部", "秘書部", "總務部"];
    let linkTypes = ["線上相簿", "回顧影片", "其他"];

    const configSheet = db.getSheetByName("Config");
    if (configSheet) {
      const configData = configSheet.getDataRange().getValues();
      for (let i = 1; i < configData.length; i++) {
        const key = configData[i][0] ? configData[i][0].toString().trim() : "";
        const val = configData[i][1] ? configData[i][1].toString().trim() : "";
        if (key === "DEPARTMENTS" && val) {
          departments = val.split(",").map(function (d) { return d.trim(); });
        } else if (key === "EXTERNAL_LINK_TYPES" && val) {
          linkTypes = val.split(",").map(function (d) { return d.trim(); });
        }
      }
    }

    return jsonResponse({ status: "success", activities: activities, departments: departments, linkTypes: linkTypes });
}

// ==========================================
// 3. 建立活動 (主機端呼叫微服務建資料夾)
// ==========================================
function handleCreateActivity(payload) {
  const { name, date, department } = payload;
  if (!name || !date || !department) {
    return jsonResponse({ status: "error", message: "請填寫活動名稱、日期與指定部門。" });
  }

  const db = getDb();
  const actSheet = db.getSheetByName("Activities");
  const configSheet = db.getSheetByName("Config");

  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }

  let rootFolderId = "";
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === "ACCOUNT_B_FOLDER_ID") {
        rootFolderId = configData[i][1];
        break;
      }
    }
  }

  if (!rootFolderId) {
    return jsonResponse({ status: "error", message: "系統未設定雲端硬碟 Root Folder ID。" });
  }

  const cleanDate = formatDateString(date);
  let folderId = "";
  try {
    // 遠端呼叫 Account B 服務建立資料夾
    const res = callStorageService("createFolder", {
      rootFolderId: rootFolderId,
      folderName: `[${cleanDate} ${name}]`
    });
    folderId = res.folderId;
  } catch (err) {
    return jsonResponse({ status: "error", message: "建立 Google Drive 資料夾失敗：" + err.toString() });
  }

  const id = "ACT_" + new Date().getTime();
  const now = new Date().toISOString();

  actSheet.appendRow([
    id,          // 0: id
    name,        // 1: name
    "'" + cleanDate, // 2: date (加單引號防 Sheets 自動變更型別)
    department,  // 3: department
    "",          // 4: location
    "",          // 5: intro
    "",          // 6: mainVisualId
    "",          // 7: albumLink
    "",          // 8: videoLink
    "Draft",     // 9: status
    folderId,    // 10: folderId
    now,         // 11: createdAt
    now,         // 12: updatedAt
    "",          // 13: mainVisualRawId
    "[]"         // 14: externalLinks (JSON)
  ]);

  return jsonResponse({ status: "success", activityId: id });
}

// ==========================================
// 4. 更新活動內容與圖片 (遠端上傳至 Account B)
// ==========================================
function handleUpdateActivity(payload) {
  const {
    id,
    name,
    date,
    location,
    intro,
    status,
    albumLink,
    videoLink,
    externalLinks,
    mainVisual,
    recordPhotos
  } = payload;

  const db = getDb();
  const actSheet = db.getSheetByName("Activities");
  const photoSheet = db.getSheetByName("RecordPhotos");

  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }

  const actData = actSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < actData.length; i++) {
    if (actData[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ status: "error", message: "找不到該活動資料。" });
  }

  const oldName = actData[rowIndex - 1][1];
  const oldDate = actData[rowIndex - 1][2];
  const oldStatus = actData[rowIndex - 1][9];
  const folderId = actData[rowIndex - 1][10];
  let mainVisualId = actData[rowIndex - 1][6];
  let mainVisualRawId = actData[rowIndex - 1][13] || "";

  const cleanDate = formatDateString(date);
  const oldCleanDate = formatDateString(oldDate);

  // A. 重命名邏輯：若名稱或日期有修改，通知微服務重新命名資料夾
  const nameChanged = (oldName !== name || oldCleanDate !== cleanDate);
  if (nameChanged && folderId) {
    callStorageService("renameFolder", {
      folderId: folderId,
      newName: `[${cleanDate} ${name}]`
    });
  }

  // B. 處理主視覺圖片 (遠端上傳/刪除：管理 1:1 切割圖與原圖)
  if (mainVisual) {
    // 刪除舊方形圖
    if (mainVisualId && (mainVisual.isDeleted || mainVisual.base64)) {
      try {
        callStorageService("deleteFile", { fileId: mainVisualId });
      } catch (e) { }
      mainVisualId = "";
    }
    // 刪除舊原圖 (若使用者刪除或重新上傳了原圖)
    if (mainVisualRawId && (mainVisual.isDeleted || mainVisual.rawBase64)) {
      try {
        callStorageService("deleteFile", { fileId: mainVisualRawId });
      } catch (e) { }
      mainVisualRawId = "";
    }

    // 上傳新原圖 (rawBase64)
    if (mainVisual.rawBase64 && !mainVisual.isDeleted) {
      const rawExt = (mainVisual.filename || "image.jpg").split('.').pop();
      const rawFileName = `[${cleanDate} ${name} MainVisual_Raw].${rawExt}`;
      const rawRes = callStorageService("uploadFile", {
        folderId: folderId,
        filename: rawFileName,
        base64: mainVisual.rawBase64,
        ext: rawExt
      });
      if (rawRes && rawRes.fileId) {
        mainVisualRawId = rawRes.fileId;
      }
    }

    // 上傳新方形圖 (base64 - 1:1 切割圖，網管部複製使用之主視覺)
    if (mainVisual.base64 && !mainVisual.isDeleted) {
      const squareFileName = `[${cleanDate} ${name} MainVisual_Square].jpg`;
      const res = callStorageService("uploadFile", {
        folderId: folderId,
        filename: squareFileName,
        base64: mainVisual.base64,
        ext: "jpg"
      });
      if (res && res.fileId) {
        mainVisualId = res.fileId;
      }
    }
  } else if (nameChanged) {
    if (mainVisualId) {
      try {
        callStorageService("renameFile", {
          fileId: mainVisualId,
          newName: `[${cleanDate} ${name} MainVisual_Square]`
        });
      } catch (e) { }
    }
    if (mainVisualRawId) {
      try {
        callStorageService("renameFile", {
          fileId: mainVisualRawId,
          newName: `[${cleanDate} ${name} MainVisual_Raw]`
        });
      } catch (e) { }
    }
  }

  // C. 處理紀錄照片
  if (photoSheet) {
    // 1. 處理刪除照片 (遠端刪除)
    if (recordPhotos) {
      recordPhotos.forEach(p => {
        if (p.isDeleted && p.photoId) {
          const pData = photoSheet.getDataRange().getValues();
          for (let i = 1; i < pData.length; i++) {
            if (pData[i][0] === p.photoId) {
              const fileId = pData[i][2];
              if (fileId) {
                callStorageService("deleteFile", { fileId: fileId });
              }
              photoSheet.deleteRow(i + 1);
              break;
            }
          }
        }
      });
    }

    // 2. 處理新增與更新相片 (遠端上傳)
    if (recordPhotos) {
      recordPhotos.forEach(p => {
        if (!p.isDeleted) {
          if (p.base64) {
            const ext = p.filename.split('.').pop();
            const tempFileName = `temp_${new Date().getTime()}_${p.filename}`;
            const res = callStorageService("uploadFile", {
              folderId: folderId,
              filename: tempFileName,
              base64: p.base64,
              ext: ext
            });

            const photoId = p.photoId || ("PHO_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000));
            photoSheet.appendRow([
              photoId,
              id,
              res.fileId,
              p.caption,
              p.photographer,
              new Date().toISOString()
            ]);
          } else if (p.photoId) {
            const pData = photoSheet.getDataRange().getValues();
            for (let i = 1; i < pData.length; i++) {
              if (pData[i][0] === p.photoId) {
                photoSheet.getRange(i + 1, 4).setValue(p.caption);
                photoSheet.getRange(i + 1, 5).setValue(p.photographer);
                break;
              }
            }
          }
        }
      });
    }

    // 3. 統一重命名排序 (遠端重命名)
    const finalPhotoData = photoSheet.getDataRange().getValues();
    let indexCount = 1;
    for (let i = 1; i < finalPhotoData.length; i++) {
      if (finalPhotoData[i][1] === id) {
        const photoFileId = finalPhotoData[i][2];
        try {
          // 因為是跨微服務重新命名，微服務的 renameFile 接受新的主檔名並會自動抓取舊檔名的副檔名進行重組
          const finalFileName = `[${date} ${name} Photo_${indexCount}]`;
          callStorageService("renameFile", {
            fileId: photoFileId,
            newName: finalFileName
          });
        } catch (e) { }
        indexCount++;
      }
    }
  }

  // D. 更新 Sheet 欄位
  const now = new Date().toISOString();
  let finalAlbumLink = albumLink || "";
  let finalVideoLink = videoLink || "";
  let finalExternalLinksJson = "";

  if (externalLinks && Array.isArray(externalLinks)) {
    finalExternalLinksJson = JSON.stringify(externalLinks);
    const albumItem = externalLinks.find(l => l.type === "線上相簿" && l.url);
    if (albumItem) finalAlbumLink = albumItem.url;
    const videoItem = externalLinks.find(l => l.type === "回顧影片" && l.url);
    if (videoItem) finalVideoLink = videoItem.url;
  }

  actSheet.getRange(rowIndex, 2).setValue(name);
  actSheet.getRange(rowIndex, 3).setValue("'" + cleanDate);
  actSheet.getRange(rowIndex, 5).setValue(location);
  actSheet.getRange(rowIndex, 6).setValue(intro);
  actSheet.getRange(rowIndex, 7).setValue(mainVisualId);
  actSheet.getRange(rowIndex, 8).setValue(finalAlbumLink);
  actSheet.getRange(rowIndex, 9).setValue(finalVideoLink);
  actSheet.getRange(rowIndex, 10).setValue(status);
  actSheet.getRange(rowIndex, 13).setValue(now);
  actSheet.getRange(rowIndex, 14).setValue(mainVisualRawId);
  actSheet.getRange(rowIndex, 15).setValue(finalExternalLinksJson);

  if (oldStatus === "Draft" && status === "Submitted") {
    sendNotificationEmail(name, date, actData[rowIndex - 1][3]);
  }

  return jsonResponse({ status: "success", mainVisualId: mainVisualId, mainVisualRawId: mainVisualRawId });
}

// ==========================================
// 5. 刪除活動 (遠端通知微服務刪除資料夾)
// ==========================================
function handleDeleteActivity(payload) {
  const { id } = payload;
  const db = getDb();
  const actSheet = db.getSheetByName("Activities");
  const photoSheet = db.getSheetByName("RecordPhotos");

  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }

  const actData = actSheet.getDataRange().getValues();
  let rowIndex = -1;
  let folderId = "";
  for (let i = 1; i < actData.length; i++) {
    if (actData[i][0] === id) {
      rowIndex = i + 1;
      folderId = actData[i][10];
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ status: "error", message: "找不到該活動。" });
  }

  // 1. 通知 Account B 微服務刪除雲端硬碟資料夾 (實體清理)
  if (folderId) {
    try {
      callStorageService("deleteFolder", { folderId: folderId });
    } catch (e) { }
  }

  // 2. 刪除照片 Sheet 紀錄
  if (photoSheet) {
    const pData = photoSheet.getDataRange().getValues();
    for (let i = pData.length - 1; i >= 1; i--) {
      if (pData[i][1] === id) {
        photoSheet.deleteRow(i + 1);
      }
    }
  }

  // 3. 刪除活動 Sheet 紀錄
  actSheet.deleteRow(rowIndex);

  return jsonResponse({ status: "success" });
}

// ==========================================
// 6. 更新活動狀態
// ==========================================
function handleUpdateStatus(payload) {
  const { id, status } = payload;
  const db = getDb();
  const actSheet = db.getSheetByName("Activities");

  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }

  const actData = actSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < actData.length; i++) {
    if (actData[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ status: "error", message: "找不到該活動。" });
  }

  const now = new Date().toISOString();
  actSheet.getRange(rowIndex, 10).setValue(status);
  actSheet.getRange(rowIndex, 13).setValue(now);

  return jsonResponse({ status: "success" });
}

// 發送郵件
function sendNotificationEmail(activityName, date, department) {
  try {
    const db = getDb();
    const configSheet = db.getSheetByName("Config");
    let itEmail = "";

    if (configSheet) {
      const configData = configSheet.getDataRange().getValues();
      for (let i = 1; i < configData.length; i++) {
        if (configData[i][0] === "IT_EMAIL") {
          itEmail = configData[i][1];
          break;
        }
      }
    }

    if (!itEmail) return;

    const subject = `【CMCollect通知】有新的系學會活動資料已提交：${activityName}`;
    const body = `網管部幹部您好：

學會活動資料蒐集與管理系統 (CMCollect) 收到一筆新提交的活動資料。

活動詳情：
- 活動名稱：${activityName}
- 活動日期：${date}
- 主辦部門：${department}

請登入 CMCollect 系統進行後續的 HTML 轉碼複製與結案處理。
本郵件由系統自動發送，請勿直接回覆。`;

    MailApp.sendEmail(itEmail, subject, body);
  } catch (e) { }
}
