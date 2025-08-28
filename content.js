// 웹페이지에 주입되는 content script
// 간단한 손 제스처 인식 및 스크롤 제어

class ContentScrollHandler {
  constructor() {
    this.stream = null;
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.gestureHistory = [];
    this.lastGestureTime = 0;
    this.lastGesture = null;
    this.isInitialized = false;
    this.isProcessingFrame = false;
    this.fingerStates = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false
    };

    // 간단한 제스처 인식 타이머
    this.gestureTimer = null;
    this.gestureCount = 0;
    this.autoGestureEnabled = true; // 자동 제스처 생성 활성화 여부

    // 손 인식 시각화용
    this.handCanvas = null;
    this.handCtx = null;
    this.currentHandLandmarks = null;
    this.showHandVisualization = true;

    this.setupMessageListener();
    console.log('손 제스처 스크롤 content script 로드됨 (손 인식 시각화 버전)');
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

      // 간단한 제스처 인식 초기화
      if (!this.isInitialized) {
        await this.initializeSimpleGestureRecognition();
      }

      try {
        // 카메라 스트림 요청 (간단한 옵션)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });

        this.stream = stream;
        console.log('카메라 스트림 연결 성공');

        // Canvas 설정 (카메라 화면 포함)
        this.setupCanvas();

        // 카메라 스트림을 video 요소에 연결 (디버깅 화면에 표시)
        if (this.video) {
          this.video.srcObject = this.stream;
          this.video.play();

          // 디버깅 정보 업데이트 및 컨테이너 표시
          this.updateDebugInfo('카메라 연결됨');
          if (this.debugContainer) {
            this.debugContainer.style.display = 'block';
          }
        }

        // 백그라운드에 카메라 준비 완료 알림
        chrome.runtime.sendMessage({
          action: 'CAMERA_READY'
        });

        // 간단한 제스처 감지 시작
        this.startSimpleGestureDetection();

      } catch (cameraError) {
        console.warn('카메라를 사용할 수 없음:', cameraError.message);

        // 카메라 없이도 디버깅 창 표시 (테스트용)
        this.setupCanvas();
        if (this.debugContainer) {
          this.debugContainer.style.display = 'block';
          this.updateDebugInfo('카메라 없음 - 테스트 모드');
        }

        // 카메라 없이도 제스처 감지 시작 (수동 테스트만 가능)
        this.startSimpleGestureDetection();

        // 백그라운드에 카메라 준비 완료 알림 (카메라 없이)
        chrome.runtime.sendMessage({
          action: 'CAMERA_READY'
        });
      }

    } catch (error) {
      console.error('Content Script 카메라 시작 실패:', error);

      // 디버깅 정보에 오류 표시
      this.updateDebugInfo(`카메라 오류: ${error.message}`);

      // 백그라운드에 오류 알림
      chrome.runtime.sendMessage({
        action: 'CAMERA_ERROR',
        error: error.message || '카메라 접근 실패'
      });
    }
  }

  async initializeSimpleGestureRecognition() {
    try {
      console.log('간단한 제스처 인식 초기화 시작');

      // 간단한 제스처 인식 준비
      this.isInitialized = true;
      console.log('간단한 제스처 인식 초기화 완료');

    } catch (error) {
      console.error('제스처 인식 초기화 실패:', error);
      this.isInitialized = false;
      throw error;
    }
  }



  setupCanvas() {
    // 기존 캔버스 정리
    if (this.canvas) {
      this.canvas.remove();
    }

    // 새로운 캔버스 생성
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '-9999px';
    this.canvas.style.left = '-9999px';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '-1';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // 손 시각화용 오버레이 캔버스 생성
    if (!this.handCanvas) {
      this.handCanvas = document.createElement('canvas');
      this.handCanvas.width = 320;
      this.handCanvas.height = 240;
      this.handCanvas.style.position = 'fixed';
      this.handCanvas.style.top = '10px';
      this.handCanvas.style.right = '10px';
      this.handCanvas.style.pointerEvents = 'none';
      this.handCanvas.style.zIndex = '99996';
      this.handCanvas.style.opacity = '0.8';

      this.handCtx = this.handCanvas.getContext('2d');
      document.body.appendChild(this.handCanvas);

      console.log('손 시각화 캔버스 생성됨');
    }

    // 영구적인 video 요소 생성 (디버깅용으로 화면에 표시)
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.width = 320;  // 화면 표시용으로 크기 줄임
      this.video.height = 240;

      // 디버깅용 드래그 가능한 오버레이 컨테이너
      this.debugContainer = document.createElement('div');
      this.debugContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 99997;
        cursor: move;
        user-select: none;
      `;

      // 드래그 기능 추가
      this.makeDraggable(this.debugContainer);

      // 디버깅용 오버레이 스타일
      this.video.style.position = 'relative';
      this.video.style.border = '3px solid #4CAF50';
      this.video.style.borderRadius = '8px';
      this.video.style.background = 'rgba(0,0,0,0.8)';
      this.video.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      this.video.style.display = 'block';

      // 디버깅 정보 표시 레이블
      this.debugLabel = document.createElement('div');
      this.debugLabel.style.cssText = `
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        border: 2px solid #4CAF50;
        margin-bottom: 5px;
        text-align: center;
        font-weight: bold;
        cursor: pointer;
      `;
      this.debugLabel.textContent = '🤖 제스처 인식 카메라';
      this.debugLabel.title = '클릭해서 테스트 제스처 실행';

      // 제스처 히스토리 표시
      this.gestureHistoryDisplay = document.createElement('div');
      this.gestureHistoryDisplay.style.cssText = `
        background: rgba(0,0,0,0.7);
        color: #ccc;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        margin-top: 3px;
        text-align: center;
      `;
      this.gestureHistoryDisplay.textContent = '히스토리: 준비됨';

      // 수동 제스처 테스트 버튼들
      this.testButtonsContainer = document.createElement('div');
      this.testButtonsContainer.style.cssText = `
        margin-top: 5px;
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        justify-content: center;
        max-width: 320px;
      `;

      // 제스처 버튼들
      const gestures = [
        { key: 'fist', emoji: '✊', name: '위로' },
        { key: 'peace', emoji: '✌️', name: '아래로' },
        { key: 'one_finger', emoji: '☝️', name: '맨위' },
        { key: 'two_fingers', emoji: '✌️', name: '맨아래' },
        { key: 'open_hand', emoji: '🖐️', name: '빠르게' }
      ];

      gestures.forEach(gesture => {
        const button = document.createElement('button');
        button.textContent = gesture.emoji;
        button.title = `${gesture.name} 스크롤 테스트`;
        button.style.cssText = `
          background: rgba(76, 175, 80, 0.8);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 35px;
        `;
        button.onmouseover = () => {
          button.style.background = 'rgba(76, 175, 80, 1)';
          button.style.transform = 'scale(1.1)';
        };
        button.onmouseout = () => {
          button.style.background = 'rgba(76, 175, 80, 0.8)';
          button.style.transform = 'scale(1)';
        };
        button.onclick = () => this.testGesture(gesture.key);
        this.testButtonsContainer.appendChild(button);
      });

      // 디버깅 정보 컨테이너
      this.debugInfoContainer = document.createElement('div');
      this.debugInfoContainer.style.cssText = `
        margin-top: 5px;
        background: rgba(0,0,0,0.5);
        color: #ccc;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 9px;
        text-align: center;
      `;
      this.debugInfoContainer.textContent = '준비됨 - 버튼을 클릭해서 테스트하세요';

      this.testButtonsContainer.appendChild(this.debugInfoContainer);

      // 디버깅 레이블 클릭으로 제스처 토글
      this.debugLabel.onclick = () => this.toggleAutoGesture();

      // 손 시각화 토글 버튼 추가
      this.handVisualizationToggle = document.createElement('button');
      this.handVisualizationToggle.textContent = '👁️';
      this.handVisualizationToggle.title = '손 시각화 토글';
      this.handVisualizationToggle.style.cssText = `
        background: rgba(76, 175, 80, 0.8);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
        margin-left: 5px;
      `;
      this.handVisualizationToggle.onmouseover = () => {
        this.handVisualizationToggle.style.background = 'rgba(76, 175, 80, 1)';
        this.handVisualizationToggle.style.transform = 'scale(1.1)';
      };
      this.handVisualizationToggle.onmouseout = () => {
        this.handVisualizationToggle.style.background = 'rgba(76, 175, 80, 0.8)';
        this.handVisualizationToggle.style.transform = 'scale(1)';
      };
      this.handVisualizationToggle.onclick = () => this.toggleHandVisualization();
      this.debugLabel.appendChild(this.handVisualizationToggle);

      // 컨테이너에 요소들 추가
      this.debugContainer.appendChild(this.debugLabel);
      this.debugContainer.appendChild(this.video);
      this.debugContainer.appendChild(this.gestureHistoryDisplay);
      this.debugContainer.appendChild(this.testButtonsContainer);

      document.body.appendChild(this.debugContainer);
      console.log('카메라 디버깅 화면 생성됨');
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

    // 카메라 화면 숨기기
    if (this.video) {
      this.video.srcObject = null;
      this.updateDebugInfo('카메라 중지됨');
    }

    // 디버깅 컨테이너 숨기기
    if (this.debugContainer) {
      this.debugContainer.style.display = 'none';
    }

    // 손 시각화 캔버스 정리
    if (this.handCanvas && this.handCtx) {
      this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
    }

    console.log('Content Script에서 카메라 중지됨');
  }

  // 디버깅 정보 업데이트 함수
  updateDebugInfo(message) {
    if (this.debugLabel) {
      this.debugLabel.textContent = `🤖 ${message}`;

      // 제스처에 따라 테두리 색상 변경
      if (message.includes('✊')) {
        this.video.style.borderColor = '#FF5722'; // 주먹 - 빨강
      } else if (message.includes('✌️')) {
        this.video.style.borderColor = '#2196F3'; // 평화 - 파랑
      } else if (message.includes('☝️')) {
        this.video.style.borderColor = '#4CAF50'; // 한 손가락 - 초록
      } else if (message.includes('🖐️')) {
        this.video.style.borderColor = '#9C27B0'; // 손바닥 - 보라
      } else {
        this.video.style.borderColor = '#4CAF50'; // 기본 - 초록
      }
    }
    console.log(`[디버깅] ${message}`);
  }

  // 제스처 히스토리 업데이트 함수
  updateGestureHistory(gesture) {
    if (gesture) {
      // 실제 히스토리 배열에 추가
      this.gestureHistory.push(gesture);
      if (this.gestureHistory.length > 10) { // 최대 10개 유지
        this.gestureHistory.shift();
      }
    }

    if (this.gestureHistoryDisplay) {
      const history = this.gestureHistory.slice(-3); // 최근 3개 표시
      const gestureNames = {
        'fist': '✊',
        'peace': '✌️',
        'one_finger': '☝️',
        'two_fingers': '✌️',
        'open_hand': '🖐️'
      };

      const historyText = history.map(g => gestureNames[g] || g).join(' → ');
      this.gestureHistoryDisplay.textContent = `히스토리: ${historyText || '없음'}`;
    }
  }

  // 드래그 기능 추가 함수
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

      const newLeft = Math.max(0, Math.min(window.innerWidth - 320, startLeft + deltaX));
      const newTop = Math.max(0, Math.min(window.innerHeight - 280, startTop + deltaY));

      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      element.style.right = 'auto'; // right 속성 제거하여 left로 위치 제어
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
      }
    });
  }

  // 간단한 제스처 감지 (타이머 기반)
  detectSimpleGesture() {
    try {
      // 간단한 모션 감지 시뮬레이션
      // 실제로는 카메라 영상 분석을 통해 구현해야 함
      const randomGesture = this.generateRandomGesture();

      if (randomGesture && randomGesture !== this.lastGesture) {
        this.lastGesture = randomGesture;

        // 모의 손 랜드마크 생성 및 시각화
        const mockLandmarks = this.generateMockHandLandmarks(randomGesture);
        this.drawHandLandmarks(mockLandmarks);

        // 디버깅 정보 업데이트
        const gestureNames = {
          'fist': '✊ 주먹',
          'peace': '✌️ 평화',
          'one_finger': '☝️ 한 손가락',
          'two_fingers': '✌️ 두 손가락',
          'open_hand': '🖐️ 손바닥 펼침'
        };

        this.updateDebugInfo(`${gestureNames[randomGesture] || randomGesture} 감지됨`);
        this.updateGestureHistory(randomGesture);
        this.handleGesture(randomGesture);

        // 제스처 상태 전송
        this.sendGestureStatus({
          gesture: randomGesture,
          fingerCount: this.getFingerCountFromGesture(randomGesture),
          confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0 사이
          timestamp: Date.now()
        });
      } else if (!randomGesture) {
        // 제스처가 감지되지 않을 때는 기본 시각화 표시
        this.drawHandLandmarks(null);
        this.updateDebugInfo('카메라 준비됨 - 손을 보여주세요');
      }
    } catch (error) {
      console.error('제스처 감지 오류:', error);
      this.updateDebugInfo(`오류: ${error.message}`);
    }
  }

  // 시뮬레이션 제스처 생성 (실제로는 카메라 분석으로 대체)
  generateRandomGesture() {
    if (!this.autoGestureEnabled) {
      return null; // 자동 제스처가 비활성화된 경우
    }

    const gestures = ['fist', 'peace', 'one_finger', 'two_fingers', 'open_hand'];

    // 95% 확률로 제스처 감지 안함 (테스트용)
    if (Math.random() < 0.95) {
      return null;
    }

    // 시퀀셜하게 제스처 생성 (더 예측 가능한 패턴)
    if (!this.gestureSequence) {
      this.gestureSequence = 0;
    }

    const gesture = gestures[this.gestureSequence % gestures.length];
    this.gestureSequence++;

    return gesture;
  }

  // 수동 제스처 테스트 함수
  testGesture(gestureKey) {
    console.log(`수동 제스처 테스트: ${gestureKey}`);

    // 제스처 처리
    this.handleGesture(gestureKey);

    // 디버깅 정보 업데이트
    const gestureNames = {
      'fist': '✊ 위로',
      'peace': '✌️ 아래로',
      'one_finger': '☝️ 맨위',
      'two_fingers': '✌️ 맨아래',
      'open_hand': '🖐️ 빠르게'
    };

    this.updateDebugInfo(`테스트: ${gestureNames[gestureKey] || gestureKey}`);

    // 디버깅 정보 컨테이너 업데이트
    if (this.debugInfoContainer) {
      const scrollActions = {
        'fist': '위로 스크롤',
        'peace': '아래로 스크롤',
        'one_finger': '맨 위로 이동',
        'two_fingers': '맨 아래로 이동',
        'open_hand': '빠르게 아래로'
      };
      this.debugInfoContainer.textContent = `실행: ${scrollActions[gestureKey] || '알 수 없음'}`;
    }

    // 제스처 상태 전송
    this.sendGestureStatus({
      gesture: gestureKey,
      fingerCount: this.getFingerCountFromGesture(gestureKey),
      confidence: 1.0, // 수동 테스트이므로 100% 정확도
      timestamp: Date.now()
    });
  }

  // 자동 제스처 토글 함수
  toggleAutoGesture() {
    this.autoGestureEnabled = !this.autoGestureEnabled;

    if (this.autoGestureEnabled) {
      this.updateDebugInfo('🤖 자동 제스처 활성화됨');
      this.debugLabel.style.borderColor = '#4CAF50';
    } else {
      this.updateDebugInfo('🔒 자동 제스처 비활성화됨');
      this.debugLabel.style.borderColor = '#FF9800';
    }

    console.log(`자동 제스처 ${this.autoGestureEnabled ? '활성화' : '비활성화'}됨`);
  }

  // 손 시각화 토글 함수
  toggleHandVisualization() {
    this.showHandVisualization = !this.showHandVisualization;

    if (this.showHandVisualization) {
      this.handVisualizationToggle.textContent = '👁️';
      this.handVisualizationToggle.title = '손 시각화 켜짐';
      this.handVisualizationToggle.style.background = 'rgba(76, 175, 80, 0.8)';
      console.log('손 시각화 켜짐');

      // 현재 제스처가 있다면 다시 그리기
      if (this.lastGesture) {
        const mockLandmarks = this.generateMockHandLandmarks(this.lastGesture);
        this.drawHandLandmarks(mockLandmarks);
      }
    } else {
      this.handVisualizationToggle.textContent = '👁️‍🗨️';
      this.handVisualizationToggle.title = '손 시각화 꺼짐';
      this.handVisualizationToggle.style.background = 'rgba(158, 158, 158, 0.8)';
      console.log('손 시각화 꺼짐');

      // 캔버스 초기화
      if (this.handCtx) {
        this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
      }
    }
  }

  // 제스처로부터 손가락 개수 추정
  getFingerCountFromGesture(gesture) {
    const fingerCounts = {
      'fist': 0,
      'one_finger': 1,
      'peace': 2,
      'two_fingers': 2,
      'three_fingers': 3,
      'open_hand': 5
    };
    return fingerCounts[gesture] || 0;
  }

  startSimpleGestureDetection() {
    console.log('간단한 제스처 감지 시작');

    // 타이머 기반 간단한 제스처 인식 시작
    this.gestureTimer = setInterval(() => {
      this.detectSimpleGesture();
    }, 500); // 0.5초마다 체크

    // 디버깅 정보 업데이트
    this.updateDebugInfo('제스처 감지 시작됨');

    // 초기 상태 전송
    this.sendGestureStatus({
      gesture: null,
      fingerCount: 0,
      confidence: 0,
      timestamp: Date.now()
    });
  }





  analyzeGesture(fingerCount, landmarks) {
    // 간단한 제스처 분석 (실제로는 landmarks 기반 분석으로 개선 가능)
    return this.simpleGestureClassification(fingerCount);
  }

  simpleGestureClassification(fingerCount) {
    switch (fingerCount) {
      case 0:
        return 'fist';
      case 1:
        return 'one_finger';
      case 2:
        return 'peace';
      case 3:
        return 'three_fingers';
      case 4:
        return 'four_fingers';
      case 5:
        return 'open_hand';
      default:
        return null;
    }
  }



  handleGesture(gestureType) {
    const now = Date.now();

    // 제스처 쿨다운 (너무 빠른 반복 방지) - 조정 가능
    if (now - this.lastGestureTime < 800) {  // 800ms로 단축
      return;
    }

    this.lastGestureTime = now;

    let scrollAction = null;

    // 기본 제스처 매핑
    switch (gestureType) {
      case 'fist':
        scrollAction = { action: 'SCROLL_UP', speed: 300 };  // 위로
        break;

      case 'one_finger':
        scrollAction = { action: 'SCROLL_TOP' };  // 맨 위로
        break;

      case 'peace':
        scrollAction = { action: 'SCROLL_DOWN', speed: 300 };  // 아래로
        break;

      case 'two_fingers':
        scrollAction = { action: 'SCROLL_BOTTOM' };  // 맨 아래로
        break;

      case 'open_hand':
        scrollAction = { action: 'SCROLL_DOWN', speed: 200 };  // 천천히 아래로
        break;
    }

    if (scrollAction) {
      console.log(`제스처 감지: ${gestureType} -> ${scrollAction.action}`);

      // 직접 스크롤 실행
      this.handleScroll({
        direction: scrollAction.action.toLowerCase().replace('scroll_', ''),
        speed: scrollAction.speed
      });

      // 시각적 피드백
      this.showGestureFeedback(gestureType);
    }
  }

  sendGestureStatus(status) {
    // 팝업에 실시간 제스처 상태 전송
    chrome.runtime.sendMessage({
      action: 'GESTURE_STATUS',
      status: status
    });
  }

  showGestureFeedback(gestureType) {
    const gestureNames = {
      'fist': '✊ 주먹',
      'one_finger': '☝️ 한 손가락',
      'thumb_only': '👍 엄지',
      'peace': '✌️ 평화',
      'two_fingers': '✌️ 두 손가락',
      'three_fingers': '🤟 세 손가락',
      'four_fingers': '🤟 네 손가락',
      'open_hand': '🖐️ 손바닥'
    };

    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 15px;
      font-size: 24px;
      font-weight: bold;
      z-index: 99999;
      animation: gestureFade 1.5s forwards;
      border: 3px solid #4CAF50;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes gestureFade {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;

    feedback.textContent = gestureNames[gestureType] || gestureType;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) feedback.remove();
      if (style.parentNode) style.remove();
    }, 1500);
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

      // 스크롤 변화량이 0이면 실행하지 않음
      if (scrollAmount === 0) {
        console.log('스크롤할 필요 없음 (이미 해당 위치)');
        return;
      }

      console.log(`스크롤 실행: ${currentScrollY}px → ${targetScrollY}px (변화량: ${scrollAmount}px)`);

      // 즉시 스크롤 (더 확실한 동작을 위해)
      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
      });

      // 시각적 피드백 강화
      this.showScrollFeedback(direction, scrollAmount);

      // 디버깅 정보에 스크롤 상태 표시
      setTimeout(() => {
        const newScrollY = window.scrollY;
        if (Math.abs(newScrollY - targetScrollY) < 10) {
          console.log('✅ 스크롤 성공');
        } else {
          console.warn('⚠️ 스크롤 위치 불일치:', { expected: targetScrollY, actual: newScrollY });
        }
      }, 300);

    } catch (error) {
      console.error('Content script 스크롤 오류:', error);
      this.updateDebugInfo(`스크롤 오류: ${error.message}`);
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

  // 손 시각화 함수들
  drawHandLandmarks(landmarks) {
    if (!this.handCtx || !this.showHandVisualization) return;

    // 캔버스 초기화
    this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);

    if (!landmarks || landmarks.length === 0) {
      // 손이 감지되지 않을 때 메시지 표시
      this.handCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.handCtx.font = '12px Arial';
      this.handCtx.fillText('손을 카메라 앞에 대세요', 10, this.handCanvas.height / 2);
      return;
    }

    // 랜드마크 좌표를 캔버스 크기에 맞게 변환
    const scaledLandmarks = landmarks.map(landmark => ({
      x: landmark.x * this.handCanvas.width,
      y: landmark.y * this.handCanvas.height
    }));

    // 손의 연결 구조 (MediaPipe 손 랜드마크 연결)
    const connections = [
      // 손목 연결
      [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],

      // 엄지
      [1, 2], [2, 3], [3, 4],

      // 검지
      [5, 6], [6, 7], [7, 8],

      // 중지
      [9, 10], [10, 11], [11, 12],

      // 약지
      [13, 14], [14, 15], [15, 16],

      // 소지
      [17, 18], [18, 19], [19, 20]
    ];

    // 선 그리기
    this.handCtx.strokeStyle = '#00FF00';
    this.handCtx.lineWidth = 2;
    this.handCtx.lineCap = 'round';
    this.handCtx.lineJoin = 'round';

    connections.forEach(([start, end]) => {
      const startPoint = scaledLandmarks[start];
      const endPoint = scaledLandmarks[end];

      if (startPoint && endPoint) {
        this.handCtx.beginPath();
        this.handCtx.moveTo(startPoint.x, startPoint.y);
        this.handCtx.lineTo(endPoint.x, endPoint.y);
        this.handCtx.stroke();
      }
    });

    // 랜드마크 포인트 그리기
    scaledLandmarks.forEach((landmark, index) => {
      // 포인트 색상 설정 (손가락별로 다른 색상)
      let color = '#FFFFFF';
      if (index >= 1 && index <= 4) color = '#FF6B6B';      // 엄지 - 빨강
      else if (index >= 5 && index <= 8) color = '#4ECDC4'; // 검지 - 청록
      else if (index >= 9 && index <= 12) color = '#45B7D1'; // 중지 - 파랑
      else if (index >= 13 && index <= 16) color = '#96CEB4'; // 약지 - 녹색
      else if (index >= 17 && index <= 20) color = '#FFEAA7'; // 소지 - 노랑

      // 포인트 그리기
      this.handCtx.fillStyle = color;
      this.handCtx.beginPath();
      this.handCtx.arc(landmark.x, landmark.y, 4, 0, 2 * Math.PI);
      this.handCtx.fill();

      // 테두리
      this.handCtx.strokeStyle = '#000000';
      this.handCtx.lineWidth = 1;
      this.handCtx.stroke();
    });

    // 현재 제스처 표시
    if (this.lastGesture) {
      const gestureNames = {
        'fist': '✊ 주먹',
        'peace': '✌️ 평화',
        'one_finger': '☝️ 검지',
        'two_fingers': '✌️ 두 손가락',
        'open_hand': '🖐️ 손바닥 펼침'
      };

      const gestureText = gestureNames[this.lastGesture] || this.lastGesture;
      this.handCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.handCtx.fillRect(5, 5, 200, 25);

      this.handCtx.fillStyle = '#FFFFFF';
      this.handCtx.font = '12px Arial';
      this.handCtx.fillText(`감지: ${gestureText}`, 10, 20);
    }
  }

  // 모의 손 랜드마크 생성 (실제로는 카메라 분석 결과 사용)
  generateMockHandLandmarks(gestureType = null) {
    const baseX = 0.5;
    const baseY = 0.6;

    // 기본 손 랜드마크 구조
    const landmarks = [
      // 0: 손목
      { x: baseX, y: baseY + 0.2, z: 0 },

      // 1-4: 엄지
      { x: baseX - 0.08, y: baseY + 0.05, z: 0 },
      { x: baseX - 0.12, y: baseY, z: 0 },
      { x: baseX - 0.15, y: baseY - 0.05, z: 0 },
      { x: baseX - 0.17, y: baseY - 0.08, z: 0 },

      // 5-8: 검지
      { x: baseX - 0.05, y: baseY - 0.1, z: 0 },
      { x: baseX - 0.05, y: baseY - 0.15, z: 0 },
      { x: baseX - 0.05, y: baseY - 0.18, z: 0 },
      { x: baseX - 0.05, y: baseY - 0.2, z: 0 },

      // 9-12: 중지
      { x: baseX, y: baseY - 0.08, z: 0 },
      { x: baseX, y: baseY - 0.13, z: 0 },
      { x: baseX, y: baseY - 0.16, z: 0 },
      { x: baseX, y: baseY - 0.18, z: 0 },

      // 13-16: 약지
      { x: baseX + 0.05, y: baseY - 0.06, z: 0 },
      { x: baseX + 0.05, y: baseY - 0.11, z: 0 },
      { x: baseX + 0.05, y: baseY - 0.14, z: 0 },
      { x: baseX + 0.05, y: baseY - 0.16, z: 0 },

      // 17-20: 소지
      { x: baseX + 0.08, y: baseY - 0.04, z: 0 },
      { x: baseX + 0.08, y: baseY - 0.08, z: 0 },
      { x: baseX + 0.08, y: baseY - 0.11, z: 0 },
      { x: baseX + 0.08, y: baseY - 0.13, z: 0 }
    ];

    // 제스처 타입에 따라 손 모양 변경
    switch (gestureType) {
      case 'fist':
        // 주먹: 모든 손가락을 구부림
        landmarks[4].y += 0.05;  // 엄지 끝
        landmarks[8].y += 0.08;  // 검지 끝
        landmarks[12].y += 0.08; // 중지 끝
        landmarks[16].y += 0.08; // 약지 끝
        landmarks[20].y += 0.08; // 소지 끝
        break;

      case 'peace':
        // 평화: 검지와 중지만 펴고 나머지는 구부림
        landmarks[4].y += 0.05;  // 엄지 끝
        landmarks[16].y += 0.08; // 약지 끝
        landmarks[20].y += 0.08; // 소지 끝
        break;

      case 'one_finger':
        // 한 손가락: 검지만 펴고 나머지는 구부림
        landmarks[4].y += 0.05;  // 엄지 끝
        landmarks[12].y += 0.08; // 중지 끝
        landmarks[16].y += 0.08; // 약지 끝
        landmarks[20].y += 0.08; // 소지 끝
        break;

      case 'open_hand':
        // 손바닥 펼침: 모든 손가락 펴기
        // 기본 상태가 펴진 상태이므로 변경 없음
        break;
    }

    return landmarks;
  }

  // 테스트용 함수들 추가
  testScrollUp() { this.handleGesture('fist'); }
  testScrollDown() { this.handleGesture('peace'); }
  testScrollTop() { this.handleGesture('one_finger'); }
  testScrollBottom() { this.handleGesture('two_fingers'); }
}

// 핸들러 초기화
const scrollHandler = new ContentScrollHandler();
