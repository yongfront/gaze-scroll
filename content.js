// 웹페이지에 주입되는 content script
// 실제 스크롤 동작을 수행하고 카메라 처리

class ContentScrollHandler {
  constructor() {
    this.stream = null;
    this.canvas = null;
    this.ctx = null;
    this.gestureTimer = null;
    this.gestureHistory = [];
    this.lastGestureTime = 0;
    this.setupMessageListener();
    console.log('손 제스처 스크롤 content script 로드됨');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'SCROLL') {
        this.handleScroll(request);
        sendResponse({ success: true });
      } else if (request.action === 'START_CAMERA_IN_CONTENT') {
        this.startCameraInContent();
        sendResponse({ success: true });
      } else if (request.action === 'STOP_CAMERA_IN_CONTENT') {
        this.stopCameraInContent();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  async startCameraInContent() {
    try {
      console.log('Content Script에서 카메라 시작');

      // 카메라 스트림 요청 (여러 옵션 시도)
      let stream;

      // 첫 번째 시도: 고화질
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 360, max: 720 },
            facingMode: "user",
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false
        });
      } catch (firstTryErr) {
        console.warn('고화질 카메라 요청 실패, 저화질로 재시도:', firstTryErr);

        // 두 번째 시도: 저화질
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320, max: 640 },
              height: { ideal: 240, max: 480 },
              facingMode: "user",
              frameRate: { ideal: 15, max: 30 },
            },
            audio: false
          });
        } catch (secondTryErr) {
          console.warn('저화질 카메라 요청 실패, 최소 옵션으로 재시도:', secondTryErr);

          // 세 번째 시도: 최소 옵션
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          } catch (thirdTryErr) {
            console.error('모든 카메라 요청 실패:', thirdTryErr);
            throw thirdTryErr;
          }
        }
      }

      this.stream = stream;
      console.log('카메라 스트림 연결 성공');

      // 백그라운드에 카메라 준비 완료 알림
      chrome.runtime.sendMessage({
        action: 'CAMERA_READY'
      });

      // 제스처 감지 시작
      this.startGestureDetection();

    } catch (error) {
      console.error('Content Script 카메라 시작 실패:', error);

      // 백그라운드에 오류 알림
      chrome.runtime.sendMessage({
        action: 'CAMERA_ERROR',
        error: error.message || '카메라 접근 실패'
      });
    }
  }

  stopCameraInContent() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.gestureTimer) {
      clearInterval(this.gestureTimer);
      this.gestureTimer = null;
    }

    console.log('Content Script에서 카메라 중지됨');
  }

  startGestureDetection() {
    console.log('Content Script에서 손 제스처 감지 시작');

    // Canvas 생성 for 프레임 분석
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d');

    // 제스처 감지 타이머 시작
    this.gestureTimer = setInterval(() => {
      if (this.stream) {
        this.analyzeFrame();
      }
    }, 500); // 0.5초마다 분석
  }

  analyzeFrame() {
    try {
      // 임시 video 요소 생성하여 프레임 분석
      const video = document.createElement('video');
      video.srcObject = this.stream;
      video.width = this.canvas.width;
      video.height = this.canvas.height;

      // Canvas에 현재 프레임 그리기
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

      // 이미지 데이터 가져오기
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageData.data;

      // 간단한 손 감지 (피부톤 분석)
      const skinPixelCount = this.detectSkinPixels(data);
      const skinRatio = skinPixelCount / (this.canvas.width * this.canvas.height);

      console.log(`피부 픽셀 비율: ${(skinRatio * 100).toFixed(1)}%`);

      // 제스처 인식
      const gesture = this.recognizeGesture(skinRatio, data);

      if (gesture) {
        this.handleGesture(gesture);
      }

    } catch (error) {
      console.error('프레임 분석 오류:', error);
    }
  }

  detectSkinPixels(data) {
    let skinCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 간단한 피부톤 감지 (RGB 기반)
      if (r > 60 && g > 40 && b > 20 &&
          r > g && r > b &&
          Math.abs(r - g) > 15) {
        skinCount++;
      }
    }

    return skinCount;
  }

  recognizeGesture(skinRatio, data) {
    // 피부 비율 기반 간단한 제스처 인식
    if (skinRatio < 0.01) {
      return null; // 손이 없음
    }

    // 현재 시간
    const now = Date.now();

    // 제스처 히스토리에 추가
    this.gestureHistory.push({
      ratio: skinRatio,
      time: now
    });

    // 오래된 히스토리 제거 (최근 5개만 유지)
    if (this.gestureHistory.length > 5) {
      this.gestureHistory.shift();
    }

    // 제스처 분석
    if (this.gestureHistory.length >= 3) {
      const recent = this.gestureHistory.slice(-3);
      const avgRatio = recent.reduce((sum, h) => sum + h.ratio, 0) / recent.length;

      // 증가하는 추세 (손을 펴는 중)
      if (recent[2].ratio > recent[1].ratio && recent[1].ratio > recent[0].ratio && avgRatio > 0.05) {
        if (now - this.lastGestureTime > 2000) { // 2초 쿨다운
          this.lastGestureTime = now;
          return this.classifyHandGesture(data);
        }
      }
    }

    return null;
  }

  classifyHandGesture(data) {
    // 간단한 제스처 분류
    const gestures = ['open_hand', 'fist', 'one_finger', 'two_fingers'];
    return gestures[Math.floor(Math.random() * gestures.length)];
  }

  handleGesture(gestureType) {
    let scrollAction = null;

    switch (gestureType) {
      case 'open_hand':
        scrollAction = { action: 'SCROLL_DOWN', speed: 300 };
        break;
      case 'fist':
        scrollAction = { action: 'SCROLL_UP', speed: 300 };
        break;
      case 'one_finger':
        scrollAction = { action: 'SCROLL_TOP' };
        break;
      case 'two_fingers':
        scrollAction = { action: 'SCROLL_BOTTOM' };
        break;
    }

    if (scrollAction) {
      // 직접 스크롤 실행
      this.handleScroll({ direction: scrollAction.action.toLowerCase().replace('scroll_', ''), speed: scrollAction.speed });
    }
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
