// CMCollect - Google Apps Script (GAS_B - 雲端硬碟儲存微服務)
// 部署帳號：Account B (儲存空間帳號)
// 部署設定：網頁應用程式，執行身分為「我(Account B)」，存取權限為「任何人」。
// 作用：專門負責在 Account B 的雲端硬碟中儲存、重新命名和刪除檔案，以確保所有空間扣除 Account B 的容量配額。

const SECRET_TOKEN = "CHOOSE_A_SECURE_TOKEN_HERE"; // 請設定與 Master 腳本一致的安全金鑰，防止惡意呼叫

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonResponse({ status: "success", message: "CMCollect Storage Service (GAS_B) is running." });
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "No payload" });
    }
    
    const request = JSON.parse(e.postData.contents);
    
    // 驗證安全性憑證
    if (request.token !== SECRET_TOKEN) {
      return jsonResponse({ status: "error", message: "憑證驗證失敗，拒絕連線。" });
    }
    
    const action = request.action;
    const payload = request.payload || {};
    
    switch (action) {
      case "createFolder":
        return handleCreateFolder(payload);
      case "renameFolder":
        return handleRenameFolder(payload);
      case "uploadFile":
        return handleUploadFile(payload);
      case "deleteFile":
        return handleDeleteFile(payload);
      case "deleteFolder":
        return handleDeleteFolder(payload);
      case "renameFile":
        return handleRenameFile(payload);
      default:
        return jsonResponse({ status: "error", message: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// 1. 建立活動資料夾
function handleCreateFolder(payload) {
  const { rootFolderId, folderName } = payload;
  if (!rootFolderId || !folderName) {
    return jsonResponse({ status: "error", message: "Missing params" });
  }
  
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const newFolder = rootFolder.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return jsonResponse({ status: "success", folderId: newFolder.getId() });
}

// 2. 重新命名活動資料夾
function handleRenameFolder(payload) {
  const { folderId, newName } = payload;
  if (!folderId || !newName) {
    return jsonResponse({ status: "error", message: "Missing params" });
  }
  
  const folder = DriveApp.getFolderById(folderId);
  folder.setName(newName);
  return jsonResponse({ status: "success" });
}

// 3. 上傳檔案 (主視覺或紀錄照片)
function handleUploadFile(payload) {
  const { folderId, filename, base64, ext } = payload;
  if (!folderId || !filename || !base64) {
    return jsonResponse({ status: "error", message: "Missing params" });
  }
  
  const folder = DriveApp.getFolderById(folderId);
  // 解碼 Base64 並建立實體檔案
  const rawData = base64.split(",")[1] || base64;
  const decodedData = Utilities.base64Decode(rawData);
  const blob = Utilities.newBlob(decodedData, getMimeType(ext), filename);
  
  const file = folder.createFile(blob);
  // 將檔案權限開啟為「知道連結的人均可檢視」，以供 lh3 URL 與前台讀取
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return jsonResponse({ status: "success", fileId: file.getId() });
}

// 4. 刪除單一檔案
function handleDeleteFile(payload) {
  const { fileId } = payload;
  if (!fileId) {
    return jsonResponse({ status: "error", message: "Missing fileId" });
  }
  
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return jsonResponse({ status: "success" });
  } catch (e) {
    // 忽略檔案已被手動刪除的錯誤
    return jsonResponse({ status: "success", note: "File already deleted or not found: " + e.toString() });
  }
}

// 5. 刪除整個活動資料夾 (含底下所有檔案)
function handleDeleteFolder(payload) {
  const { folderId } = payload;
  if (!folderId) {
    return jsonResponse({ status: "error", message: "Missing folderId" });
  }
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    folder.setTrashed(true);
    return jsonResponse({ status: "success" });
  } catch (e) {
    return jsonResponse({ status: "success", note: "Folder already deleted or not found" });
  }
}

// 6. 重新命名單一檔案
function handleRenameFile(payload) {
  const { fileId, newName } = payload;
  if (!fileId || !newName) {
    return jsonResponse({ status: "error", message: "Missing params" });
  }
  
  try {
    const file = DriveApp.getFileById(fileId);
    file.setName(newName);
    return jsonResponse({ status: "success" });
  } catch (e) {
    return jsonResponse({ status: "error", message: e.toString() });
  }
}

// Mime Type 對照
function getMimeType(ext) {
  if (!ext) return "application/octet-stream";
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
