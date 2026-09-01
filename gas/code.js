// CMCollect - Google Apps Script (GAS) Standalone Web App Backend
// 部署時請選擇「網頁應用程式」，並設定「執行身分」為「建立者帳號(Account A)」，「具有存取權限的人」為「任何人」。

const DB_ID = "YOUR_GOOGLE_SHEET_ID_HERE"; // 請替換為 Google Sheet 的 ID

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
    const parts = str.split("~").map(function(s) { return formatDateString(s.trim()); });
    return parts[0] === parts[1] || !parts[1] ? parts[0] : parts[0] + " ~ " + parts[1];
  }
  if (str.indexOf("T") !== -1 || str.indexOf("Z") !== -1) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const tz = Session.getScriptTimeZone() || "Asia/Taipei";
        return Utilities.formatDate(d, tz, "yyyy-MM-dd");
      }
    } catch(e) {}
  }
  return str;
}

// 處理 CORS 的回傳輔助函式
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 處理 GET 請求 (可用於測試部署狀態)
function doGet(e) {
  return jsonResponse({ status: "success", message: "CMCollect GAS API is running." });
}

// 處理 POST 請求 (API 主要入口)
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
  // 欄位索引：0: username, 1: password, 2: name, 3: role, 4: department
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
  
  // 欄位索引對照：
  // 0: id, 1: name, 2: date, 3: department, 4: location, 5: intro, 
  // 6: mainVisualId, 7: albumLink, 8: videoLink, 9: status, 10: folderId, 11: createdAt, 12: updatedAt
  
  // 取得照片資料
  let photos = [];
  if (photoSheet) {
    const photoData = photoSheet.getDataRange().getValues();
    // 0: photoId, 1: activityId, 2: fileId, 3: caption, 4: photographer, 5: createdAt
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
    
    // 權限篩選：DeptHead 只能看見自己部門的活動
    if (role === "DeptHead" && actDept !== department) {
      continue;
    }
    
    const actId = actData[i][0];
    const actPhotos = photos.filter(p => p.activityId === actId);
    
    let extLinks = [];
    if (actData[i][14]) {
      try {
        extLinks = JSON.parse(actData[i][14]);
      } catch (e) {}
    }
    if (!extLinks || extLinks.length === 0) {
      if (actData[i][7]) extLinks.push({ id: "link_album", type: "線上相簿", title: "線上相簿", url: actData[i][7] });
      if (actData[i][8]) extLinks.push({ id: "link_video", type: "回顧影片", title: "回顧影片", url: actData[i][8] });
    }
    
    activities.push({
      id: actId,
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
  
  // 排序：依據 createdAt 降冪排列 (新活動在前)
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
        departments = val.split(",").map(function(d) { return d.trim(); });
      } else if (key === "EXTERNAL_LINK_TYPES" && val) {
        linkTypes = val.split(",").map(function(d) { return d.trim(); });
      }
    }
  }
  
  return jsonResponse({ status: "success", activities: activities, departments: departments, linkTypes: linkTypes });
}

// ==========================================
// 3. 建立活動 (快速表單)
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
  
  // 取得 Account B Folder ID
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
    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const folderName = `[${cleanDate} ${name}]`;
    const newFolder = rootFolder.createFolder(folderName);
    folderId = newFolder.getId();
  } catch (err) {
    return jsonResponse({ status: "error", message: "建立 Google Drive 資料夾失敗：" + err.toString() });
  }
  
  const id = "ACT_" + new Date().getTime();
  const now = new Date().toISOString();
  
  // 寫入 Sheet
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
// 4. 更新活動內容與圖片管理
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
    mainVisual,       // { base64: "", filename: "", isDeleted: boolean }
    recordPhotos      // Array: [ { photoId, caption, photographer, base64, filename, isDeleted } ]
  } = payload;
  
  const db = getDb();
  const actSheet = db.getSheetByName("Activities");
  const photoSheet = db.getSheetByName("RecordPhotos");
  
  if (!actSheet) {
    return jsonResponse({ status: "error", message: "找不到 Activities 工作表。" });
  }
  
  // 找出該活動在 Sheet 的列號
  const actData = actSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < actData.length; i++) {
    if (actData[i][0] === id) {
      rowIndex = i + 1; // 1-indexed for sheets
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

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (err) {
    return jsonResponse({ status: "error", message: "無法存取該活動的雲端硬碟資料夾。" });
  }
  
  // A. 重命名邏輯：若名稱或日期有修改
  const nameChanged = (oldName !== name || oldCleanDate !== cleanDate);
  if (nameChanged) {
    const newFolderName = `[${cleanDate} ${name}]`;
    folder.setName(newFolderName);
  }
  
  // B. 處理主視覺圖片 (方形圖與原圖)
  if (mainVisual) {
    // 刪除舊方形圖
    if (mainVisualId && (mainVisual.isDeleted || mainVisual.base64)) {
      try {
        DriveApp.getFileById(mainVisualId).setTrashed(true);
      } catch (e) {}
      mainVisualId = "";
    }
    // 刪除舊原圖
    if (mainVisualRawId && (mainVisual.isDeleted || mainVisual.rawBase64)) {
      try {
        DriveApp.getFileById(mainVisualRawId).setTrashed(true);
      } catch (e) {}
      mainVisualRawId = "";
    }
    
    // 上傳新原圖
    if (mainVisual.rawBase64 && !mainVisual.isDeleted) {
      const rawExt = (mainVisual.filename || "image.jpg").split('.').pop();
      const rawFileName = `[${cleanDate} ${name} MainVisual_Raw].${rawExt}`;
      const rawBlob = Utilities.newBlob(Utilities.base64Decode(mainVisual.rawBase64.split(",")[1] || mainVisual.rawBase64), getMimeType(rawExt), rawFileName);
      const rawFile = folder.createFile(rawBlob);
      rawFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      mainVisualRawId = rawFile.getId();
    }

    // 上傳新方形圖 (1:1 切割後圖檔)
    if (mainVisual.base64 && !mainVisual.isDeleted) {
      const squareFileName = `[${cleanDate} ${name} MainVisual_Square].jpg`;
      const blob = Utilities.newBlob(Utilities.base64Decode(mainVisual.base64.split(",")[1] || mainVisual.base64), "image/jpeg", squareFileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      mainVisualId = file.getId();
    }
  } else if (nameChanged) {
    if (mainVisualId) {
      try {
        DriveApp.getFileById(mainVisualId).setName(`[${cleanDate} ${name} MainVisual_Square].jpg`);
      } catch (e) {}
    }
    if (mainVisualRawId) {
      try {
        const file = DriveApp.getFileById(mainVisualRawId);
        const ext = file.getName().split('.').pop();
        file.setName(`[${cleanDate} ${name} MainVisual_Raw].${ext}`);
      } catch (e) {}
    }
  }
  
  // C. 處理紀錄照片
  if (photoSheet) {
    // 1. 處理刪除照片
    if (recordPhotos) {
      recordPhotos.forEach(p => {
        if (p.isDeleted && p.photoId) {
          // 在 Sheet 中尋找
          const pData = photoSheet.getDataRange().getValues();
          for (let i = 1; i < pData.length; i++) {
            if (pData[i][0] === p.photoId) {
              const fileId = pData[i][2];
              if (fileId) {
                try {
                  DriveApp.getFileById(fileId).setTrashed(true);
                } catch (e) {}
              }
              photoSheet.deleteRow(i + 1);
              break;
            }
          }
        }
      });
    }
    
    // 2. 處理新增與更新相片
    if (recordPhotos) {
      recordPhotos.forEach(p => {
        if (!p.isDeleted) {
          if (p.base64) {
            // 新上傳
            const ext = p.filename.split('.').pop();
            // 先用一個臨時檔名，稍後再統一重新命名
            const tempFileName = `temp_${new Date().getTime()}_${p.filename}`;
            const blob = Utilities.newBlob(Utilities.base64Decode(p.base64.split(",")[1] || p.base64), getMimeType(ext), tempFileName);
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            const photoId = p.photoId || ("PHO_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000));
            photoSheet.appendRow([
              photoId,      // 0: photoId
              id,           // 1: activityId
              file.getId(), // 2: fileId
              p.caption,    // 3: caption
              p.photographer, // 4: photographer
              new Date().toISOString() // 5: createdAt
            ]);
          } else if (p.photoId) {
            // 僅更新文字 (caption / photographer)
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
    
    // 3. 統一對現存的紀錄照片在 Google Drive 與 Sheet 中進行重新命名排序
    // 這樣可以維持 Photo_1, Photo_2... 乾淨的檔名序列
    const finalPhotoData = photoSheet.getDataRange().getValues();
    let indexCount = 1;
    for (let i = 1; i < finalPhotoData.length; i++) {
      if (finalPhotoData[i][1] === id) {
        const photoFileId = finalPhotoData[i][2];
        try {
          const file = DriveApp.getFileById(photoFileId);
          const ext = file.getName().split('.').pop() || "jpg";
          const finalFileName = `[${cleanDate} ${name} Photo_${indexCount}].${ext}`;
          file.setName(finalFileName);
        } catch (e) {
          // 若檔案已被手動刪除等
        }
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
  actSheet.getRange(rowIndex, 13).setValue(now); // updatedAt
  actSheet.getRange(rowIndex, 14).setValue(mainVisualRawId);
  actSheet.getRange(rowIndex, 15).setValue(finalExternalLinksJson);
  
  // E. 狀態從 Draft -> Submitted 的郵件通知邏輯
  if (oldStatus === "Draft" && status === "Submitted") {
    sendNotificationEmail(name, date, actData[rowIndex - 1][3]); // 傳入活動名稱、日期、部門
  }
  
  return jsonResponse({ status: "success", mainVisualId: mainVisualId, mainVisualRawId: mainVisualRawId });
}

// ==========================================
// 5. 刪除活動與所有雲端硬碟檔案
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
  
  // 1. 刪除 Google Drive 資料夾
  if (folderId) {
    try {
      DriveApp.getFolderById(folderId).setTrashed(true);
    } catch (e) {
      // 忽略資料夾不存在的錯誤
    }
  }
  
  // 2. 刪除 RecordPhotos 表中的相片紀錄
  if (photoSheet) {
    const pData = photoSheet.getDataRange().getValues();
    // 逆向刪除避免索引偏移
    for (let i = pData.length - 1; i >= 1; i--) {
      if (pData[i][1] === id) {
        photoSheet.deleteRow(i + 1);
      }
    }
  }
  
  // 3. 刪除 Activities 表中的紀錄
  actSheet.deleteRow(rowIndex);
  
  return jsonResponse({ status: "success" });
}

// ==========================================
// 6. 更新活動狀態 (IT 網管部專用結案)
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

// ==========================================
// 📧 郵件發送輔助函式
// ==========================================
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
    
    if (!itEmail) return; // 沒有信箱設定則不發信
    
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
  } catch (e) {
    // 忽略發信失敗 (可能因為配額或權限)
  }
}

// 取得副檔名對應的 Mime Type
function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return MimeType.JPEG;
    case "png":
      return MimeType.PNG;
    case "gif":
      return MimeType.GIF;
    case "pdf":
      return MimeType.PDF;
    default:
      return "application/octet-stream";
  }
}
