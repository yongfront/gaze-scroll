// 웹페이지에 주입되는 content script
// 실제 스크롤 동작을 수행

class ContentScrollHandler {
  constructor() {
    this.setupMessageListener();
    console.log('손 제스처 스크롤 content script 로드됨');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'SCROLL') {
        this.handleScroll(request);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  handleScroll(request) {
    const { direction, speed = 150 } = request;
    const currentScrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    console.log('Content script에서 스크롤 실행:', { direction, speed });

    try {
      let targetScrollY = currentScrollY;

      switch (direction) {
        case 'up':
          targetScrollY = Math.max(currentScrollY - speed, 0);
          break;
        case 'down':
          targetScrollY = Math.min(currentScrollY + speed, documentHeight - windowHeight);
          break;
        case 'top':
          targetScrollY = 0;
          break;
        case 'bottom':
          targetScrollY = documentHeight - windowHeight;
          break;
        default:
          return;
      }

      // 부드러운 스크롤
      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
      });

      // 시각적 피드백 (옵션)
      this.showScrollFeedback(direction);

    } catch (error) {
      console.error('Content script 스크롤 오류:', error);
    }
  }

  showScrollFeedback(direction) {
    // 간단한 시각적 피드백
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      z-index: 99999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      animation: fadeOut 2s forwards;
    `;

    const emojis = {
      'up': '⬆️ 위로',
      'down': '⬇️ 아래로',
      'top': '🔝 맨 위로',
      'bottom': '🔻 맨 아래로'
    };

    feedback.textContent = `손 제스처: ${emojis[direction] || direction}`;

    // 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    // 2초 후 제거
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 2000);
  }
}

// 핸들러 초기화
const scrollHandler = new ContentScrollHandler();
