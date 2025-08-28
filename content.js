// 웹페이지에 주입되는 content script
// 간단한 손 제스처 시뮬레이션 및 스크롤 제어

// 안전한 클래스 선언을 위한 중복 방지
if (typeof window.ContentScrollHandler === 'undefined') {
  console.log('[ContentScript] ContentScrollHandler 클래스 선언 시작');

class ContentScrollHandler {
  constructor() {
    this.gestureHistory = [];
    this.lastGestureTime = 0;
    this.lastGesture = null;
    this.gestureTimer = null;
    this.autoGestureEnabled = true;
    this.showDebugUI = true;

    this.setupMessageListener();
    this.createDebugUI();
    console.log('손 제스처 스크롤 content script 로드됨 (시뮬레이션 모드)');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'SCROLL') {
        this.handleScroll(request);
        sendResponse({ success: true });
      } else if (request.action === 'START_GESTURE_SIMULATION') {
        this.startGestureSimulation();
        sendResponse({ success: true });
      } else if (request.action === 'STOP_GESTURE_SIMULATION') {
        this.stopGestureSimulation();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  createDebugUI() {
    if (!this.showDebugUI) return;

    // 디버깅 패널 생성
    this.debugPanel = document.createElement('div');
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 99999;
      max-width: 300px;
      cursor: move;
    `;

    this.debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">🤖 제스처 시뮬레이터</div>
      <div style="margin-bottom: 10px;">
        <strong>지원 제스처:</strong><br/>
        ✊ 주먹 → 위로 스크롤<br/>
        ✌️ 평화 → 아래로 스크롤<br/>
        ☝️ 한 손가락 → 맨 위로<br/>
        🖐️ 손바닥 → 맨 아래로
      </div>
      <div id="gestureStatus" style="margin-bottom: 10px;">상태: 준비됨</div>
      <div style="display: flex; gap: 5px; flex-wrap: wrap;">
        <button id="fistBtn" style="background: #4CAF50; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">✊</button>
        <button id="peaceBtn" style="background: #2196F3; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">✌️</button>
        <button id="oneFingerBtn" style="background: #FF9800; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">☝️</button>
        <button id="openHandBtn" style="background: #9C27B0; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">🖐️</button>
      </div>
    `;

    // 드래그 기능 추가
    this.makeDraggable(this.debugPanel);

    // 버튼 이벤트 리스너 추가
    const buttons = this.debugPanel.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const gestureType = e.target.id.replace('Btn', '').replace('Finger', '_finger');
        this.simulateGesture(gestureType);
      });
    });

    document.body.appendChild(this.debugPanel);
  }

  makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 300, startLeft + deltaX));
      const newTop = Math.max(0, Math.min(window.innerHeight - 200, startTop + deltaY));
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
      }
    });
  }

  simulateGesture(gestureType) {
    const now = Date.now();
    if (now - this.lastGestureTime < 800) return;

    this.lastGestureTime = now;
    this.lastGesture = gestureType;

    // 제스처 히스토리 업데이트
    this.gestureHistory.push(gestureType);
    if (this.gestureHistory.length > 10) {
      this.gestureHistory.shift();
    }

    // 디버깅 패널 업데이트
    this.updateGestureStatus(gestureType);

    // 제스처 처리
    this.handleGesture(gestureType);
  }

  updateGestureStatus(gestureType) {
    const gestureNames = {
      'fist': '✊ 주먹',
      'peace': '✌️ 평화',
      'one_finger': '☝️ 한 손가락',
      'open_hand': '🖐️ 손바닥'
    };

    const statusElement = this.debugPanel.querySelector('#gestureStatus');
    if (statusElement) {
      statusElement.textContent = `감지: ${gestureNames[gestureType] || gestureType}`;
    }
  }

  handleGesture(gestureType) {
    let scrollAction = null;

    switch (gestureType) {
      case 'fist':
        scrollAction = { action: 'SCROLL_UP', speed: 300 };
        break;
      case 'peace':
        scrollAction = { action: 'SCROLL_DOWN', speed: 300 };
        break;
      case 'one_finger':
        scrollAction = { action: 'SCROLL_TOP' };
        break;
      case 'open_hand':
        scrollAction = { action: 'SCROLL_BOTTOM' };
        break;
    }

    if (scrollAction) {
      console.log(`제스처 감지: ${gestureType} -> ${scrollAction.action}`);
      this.handleScroll({
        direction: scrollAction.action.toLowerCase().replace('scroll_', ''),
        speed: scrollAction.speed
      });
    }
  }

  handleScroll(request) {
    const { direction, speed = 150 } = request;
    const currentScrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    console.log('Content script에서 스크롤 실행:', {
      direction,
      speed,
      currentScrollY,
      windowHeight,
      documentHeight
    });

    try {
      let targetScrollY = currentScrollY;
      let scrollAmount = 0;

      switch (direction) {
        case 'up':
          scrollAmount = -speed;
          targetScrollY = Math.max(currentScrollY + scrollAmount, 0);
          break;
        case 'down':
          scrollAmount = speed;
          targetScrollY = Math.min(currentScrollY + scrollAmount, documentHeight - windowHeight);
          break;
        case 'top':
          scrollAmount = -currentScrollY;
          targetScrollY = 0;
          break;
        case 'bottom':
          scrollAmount = documentHeight - windowHeight - currentScrollY;
          targetScrollY = documentHeight - windowHeight;
          break;
        default:
          console.warn('알 수 없는 스크롤 방향:', direction);
          return;
      }

      if (scrollAmount === 0) {
        console.log('스크롤할 필요 없음 (이미 해당 위치)');
        return;
      }

      console.log(`스크롤 실행: ${currentScrollY}px → ${targetScrollY}px (변화량: ${scrollAmount}px)`);

      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
      });

      // 시각적 피드백
      this.showScrollFeedback(direction, scrollAmount);

    } catch (error) {
      console.error('Content script 스크롤 오류:', error);
    }
  }

  showScrollFeedback(direction) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
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

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) feedback.remove();
      if (style.parentNode) style.remove();
    }, 2000);
  }

  startGestureSimulation() {
    console.log('제스처 시뮬레이션 시작');
    this.autoGestureEnabled = true;
    this.updateGestureStatus('시뮬레이션 시작');
  }

  stopGestureSimulation() {
    console.log('제스처 시뮬레이션 중지');
    this.autoGestureEnabled = false;
    if (this.gestureTimer) {
      clearInterval(this.gestureTimer);
      this.gestureTimer = null;
    }
    this.updateGestureStatus('시뮬레이션 중지');
  }
}

// 클래스 선언 끝
window.ContentScrollHandler = ContentScrollHandler;
  console.log('[ContentScript] ContentScrollHandler 클래스 선언 완료');
} else {
  console.log('[ContentScript] ContentScrollHandler 클래스가 이미 존재합니다');
}

// 전역 ContentScrollHandler 인스턴스 초기화 (안전하게)
if (typeof window.scrollHandler === 'undefined' && typeof ContentScrollHandler !== 'undefined') {
  try {
    console.log('[ContentScript] ContentScrollHandler 인스턴스 생성 시작');
    window.scrollHandler = new ContentScrollHandler();
    console.log('[ContentScript] ContentScrollHandler 초기화 성공 ✅');
  } catch (error) {
    console.error('[ContentScript] ContentScrollHandler 초기화 실패:', error);
    console.error('[ContentScript] 오류 상세:', error.stack);
  }
} else if (typeof window.scrollHandler !== 'undefined') {
  console.log('[ContentScript] ContentScrollHandler 인스턴스가 이미 존재합니다');
} else {
  console.warn('[ContentScript] ContentScrollHandler 클래스를 찾을 수 없습니다');
}
