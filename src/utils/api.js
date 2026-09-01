// CMCollect - API 服務模組與 Mock 資料機制
const resolveGasUrl = () => {
  const vUrl = (import.meta.env.VITE_GAS_API_URL || '').trim();
  const cUrl = (import.meta.env.REACT_APP_GAS_API_URL || '').trim();
  if (vUrl.startsWith('http://') || vUrl.startsWith('https://')) return vUrl;
  if (cUrl.startsWith('http://') || cUrl.startsWith('https://')) return cUrl;
  return '';
};
const GAS_URL = resolveGasUrl();

export const callApi = async (action, payload) => {
  if (!GAS_URL || GAS_URL.includes("YOUR_DEPLOYED_GAS_WEB_APP_ID")) {
    // 開發階段若未設定 API URL，回傳 Mock 資料方便驗證
    return getMockData(action, payload);
  }
  
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain", // 避免 OPTIONS 預檢請求
      },
      body: JSON.stringify({ action, payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("API Request Failed:", err);
    throw new Error("無法連接至後端服務，請確認 GAS API 部署網址是否正確。");
  }
};

// 模擬資料產生器 (開發測試用)
function getMockData(action, payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (action) {
        case "login":
          const { username } = payload;
          if (username === 'admin') {
            resolve({
              status: "success",
              user: { username: "admin", name: "會長長", role: "Leadership", department: "會本部" }
            });
          } else if (username === 'it') {
            resolve({
              status: "success",
              user: { username: "it", name: "網管小編", role: "ITDept", department: "網管部" }
            });
          } else {
            resolve({
              status: "success",
              user: { username: username, name: `${username}部長`, role: "DeptHead", department: "活動部" }
            });
          }
          break;
        case "getActivities":
          resolve({
            status: "success",
            activities: [
              {
                id: "ACT_1",
                name: "中醫週骨傷體驗工作坊",
                date: "2026-05-15",
                department: "學術部",
                location: "國術教室",
                intro: "本次骨傷體驗工作坊旨在讓學生與大眾體驗中醫骨傷的推拿與包藥手法。講師生動有趣的教學引發學員廣大迴響，為期兩天的活動圓滿落幕。",
                mainVisualId: "1-vRk9gVpP6SXZ2fR0gH8eW2D7c",
                albumLink: "https://photos.google.com/mock-album-1",
                videoLink: "https://youtube.com/mock-video-1",
                status: "Submitted",
                folderId: "folder_mock_1",
                createdAt: "2026-05-15T08:00:00.000Z",
                updatedAt: "2026-05-15T12:00:00.000Z",
                recordPhotos: [
                  { photoId: "PHO_1", activityId: "ACT_1", fileId: "1-vRk9gVpP6SXZ2fR0gH8eW2D7c", caption: "講師示範手法", photographer: "Alex" },
                  { photoId: "PHO_2", activityId: "ACT_1", fileId: "1-vRk9gVpP6SXZ2fR0gH8eW2D7c", caption: "學員練習骨傷包紮", photographer: "Sarah" },
                  { photoId: "PHO_3", activityId: "ACT_1", fileId: "1-vRk9gVpP6SXZ2fR0gH8eW2D7c", caption: "大合照留念", photographer: "活動組" }
                ]
              },
              {
                id: "ACT_2",
                name: "系卡拉OK大賽",
                date: "2026-06-20",
                department: "活動部",
                location: "第一學生活動中心",
                intro: "系卡拉OK大賽是中醫系一年一度的音樂盛宴，集結了全系各路歌唱好手同台競技。活動當天現場氣氛熱烈，觀眾反應極佳。",
                mainVisualId: "",
                albumLink: "",
                videoLink: "",
                status: "Draft",
                folderId: "folder_mock_2",
                createdAt: "2026-06-20T08:00:00.000Z",
                updatedAt: "2026-06-20T08:00:00.000Z",
                recordPhotos: []
              }
            ]
          });
          break;
        case "createActivity":
          resolve({ status: "success", activityId: "ACT_" + new Date().getTime() });
          break;
        case "updateActivity":
          resolve({ status: "success", mainVisualId: "new_visual_id_123" });
          break;
        case "deleteActivity":
          resolve({ status: "success" });
          break;
        case "updateStatus":
          resolve({ status: "success" });
          break;
        default:
          resolve({ status: "error", message: "Unknown action" });
      }
    }, 800);
  });
}
