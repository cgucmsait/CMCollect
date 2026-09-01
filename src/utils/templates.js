// CMCollect - 網管部 HTML 複製模板工具

// 1. 複製簡介：完全契合最新 Scroll_bar.html 範本 (包含 <p>、<span>、Open Sans 與行高設定)
export const getIntroductionHtml = (introContent) => {
  let content = (introContent || '').trim();
  if (!content) {
    return `<div style="width: 100%; height: 100%; overflow: auto; border: none; outline: none; font-family: 'Libre Baskerville', serif; font-size: 20px; word-break: break-word;">
    <p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size: 14pt; font-family: &quot;Open Sans&quot;; background-color: transparent; font-variant: normal; vertical-align: baseline; white-space: pre-wrap;"></span></p>
</div>`;
  }

  // 若內容為純文字（無 HTML 標籤），自動轉為 Scroll_bar.html 的 p+span 段落結構
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    const paragraphs = content.split(/\r?\n+/).map(p => p.trim()).filter(Boolean);
    content = paragraphs.map((p, idx) => {
      const isFirst = idx === 0;
      const lineHeight = isFirst ? '1.38' : '1.5';
      const marginTop = isFirst ? '0pt' : '12pt';
      return `<p dir="ltr" style="line-height:${lineHeight};margin-top:${marginTop};margin-bottom:0pt;"><span style="font-size: 14pt; font-family: &quot;Open Sans&quot;; background-color: transparent; font-variant: normal; vertical-align: baseline; white-space: pre-wrap;">${p}</span></p>`;
    }).join('\n    ');
  }

  return `<div style="width: 100%; height: 100%; overflow: auto; border: none; outline: none; font-family: 'Libre Baskerville', serif; font-size: 20px; word-break: break-word;">
    ${content}
</div>`;
};

// 2. 複製相片輪播：替換 picture_display.html 並輸出完整的 HTML 內容
export const getPictureDisplayHtml = (recordPhotos = []) => {
  // 將紀錄相片資料轉換為 lh3 格式的物件陣列
  const photosJson = recordPhotos.map(p => {
    const fileId = p.fileId;
    const lh3Url = `https://lh3.googleusercontent.com/d/${fileId}`;
    return {
      url: lh3Url,
      caption: p.caption || "",
      photographer: p.photographer ? `攝 / ${p.photographer}` : ""
    };
  });

  const photoDatabaseStr = `const photoDatabase = ${JSON.stringify(photosJson, null, 6)};`;

  // 返回完整的 HTML 內容，內含 CSS、輪播 JS 邏輯，並完全契合 picture_display.html 範本
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>純照片輪播 (Database 結構版)</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="cgucm-theme.css">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-color, #faf6f0);
      color: var(--text-main, #432211);
    }

    .carousel-wrapper {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }

    .slides-container {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .slide {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.6s ease-in-out, visibility 0.6s;
    }

    .slide.active {
      opacity: 1;
      visibility: visible;
    }

    .slide-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .slide-caption-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(67, 34, 17, 0.85));
      padding: 32px 24px 16px 24px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      z-index: 2;
      pointer-events: none;
    }

    .caption-text {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-shadow: 0 2px 4px rgba(67, 34, 17, 0.5);
    }

    .photographer-text {
      font-size: 0.8rem;
      font-weight: 500;
      background: var(--accent-light, #f2daa9);
      color: var(--text-main, #432211);
      padding: 3px 10px;
      border-radius: var(--border-radius, 12px);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      backdrop-filter: blur(4px);
      border: 1px solid var(--border-color, #ebdcc5);
    }

    .carousel-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(4px);
      border: 1px solid var(--border-color, #ebdcc5);
      color: var(--primary-color, #843f16);
      width: 42px;
      height: 42px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      z-index: 3;
      transition: var(--transition, all 0.3s ease);
      box-shadow: 0 4px 10px var(--shadow-color, rgba(132, 63, 22, 0.08));
    }

    .carousel-btn:hover {
      background: var(--primary-color, #843f16);
      color: #ffffff;
      border-color: var(--primary-hover, #5e2a11);
      transform: translateY(-50%) scale(1.1);
    }

    .carousel-btn.prev { left: 16px; }
    .carousel-btn.next { right: 16px; }

    .carousel-dots {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 3;
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid var(--border-color, #ebdcc5);
      padding: 6px 12px;
      border-radius: 20px;
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 10px var(--shadow-color, rgba(132, 63, 22, 0.08));
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-light, #f2daa9);
      cursor: pointer;
      transition: var(--transition, all 0.3s ease);
    }

    .dot.active {
      background: var(--primary-color, #843f16);
      width: 20px;
      border-radius: 4px;
    }

    @media (max-width: 480px) {
      .carousel-btn { width: 34px; height: 34px; font-size: 1rem; }
      .carousel-btn.prev { left: 8px; }
      .carousel-btn.next { right: 8px; }
      .caption-text { font-size: 0.9rem; }
    }
  </style>
</head>
<body>

  <div class="carousel-wrapper" id="carousel">
    <button class="carousel-btn prev" onclick="moveSlide(-1)" aria-label="上一張">&#10094;</button>
    <button class="carousel-btn next" onclick="moveSlide(1)" aria-label="下一張">&#10095;</button>
    <div class="carousel-dots" id="carouselDots"></div>
    <div class="slides-container" id="slidesContainer"></div>
  </div>

  <script>
    // =========================================================
    // 🗃️ 相片資料庫 (Database) - 透過 CMCollect 自動產生
    // =========================================================
    ${photoDatabaseStr}

    // =========================================================
    // ⚙️ 動態渲染與輪播邏輯
    // =========================================================
    let currentSlide = 0;
    let autoPlayTimer = null;

    const slidesContainer = document.getElementById('slidesContainer');
    const dotsContainer = document.getElementById('carouselDots');

    function renderCarousel() {
      slidesContainer.innerHTML = '';
      dotsContainer.innerHTML = '';

      photoDatabase.forEach((photo, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.classList.add('slide');
        if (index === 0) slideDiv.classList.add('active');

        slideDiv.innerHTML = \`
          <img class="slide-img" src="\${photo.url}" alt="\${photo.caption}">
          <div class="slide-caption-bar">
            <span class="caption-text">\${photo.caption}</span>
            <span class="photographer-text">\${photo.photographer}</span>
          </div>
\`;
        slidesContainer.appendChild(slideDiv);

        const dotDiv = document.createElement('div');
        dotDiv.classList.add('dot');
        if (index === 0) dotDiv.classList.add('active');
        dotDiv.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dotDiv);
      });
    }

    function updateSlides() {
      const slides = document.querySelectorAll('.slide');
      const dots = document.querySelectorAll('.dot');

      slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
      });
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
      });
    }

    function moveSlide(direction) {
      if (photoDatabase.length === 0) return;
      currentSlide = (currentSlide + direction + photoDatabase.length) % photoDatabase.length;
      updateSlides();
      resetTimer();
    }

    function goToSlide(index) {
      currentSlide = index;
      updateSlides();
      resetTimer();
    }

    function startTimer() {
      if (photoDatabase.length <= 1) return;
      autoPlayTimer = setInterval(() => {
        moveSlide(1);
      }, 4000);
    }

    function resetTimer() {
      clearInterval(autoPlayTimer);
      startTimer();
    }

    renderCarousel();
    startTimer();

    const carouselEl = document.getElementById('carousel');
    carouselEl.addEventListener('mouseenter', () => clearInterval(autoPlayTimer));
    carouselEl.addEventListener('mouseleave', startTimer);
  </script>

</body>
</html>`;
};
