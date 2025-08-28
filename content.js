// 웹페이지에 주입되는 content script
// MediaPipe Hands를 사용한 정확한 손 제스처 인식 및 스크롤 제어

class ContentScrollHandler {
  constructor() {
    this.stream = null;
    this.canvas = null;
    this.ctx = null;
    this.hands = null;
    this.video = null; // 영구적인 video 요소
    this.gestureHistory = [];
    this.lastGestureTime = 0;
    this.lastGesture = null;
    this.isInitialized = false;
    this.isProcessingFrame = false; // 프레임 처리 중복 방지
    this.fingerStates = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false
    };
    this.setupMessageListener();
    console.log('손 제스처 스크롤 content script 로드됨 (개선된 MediaPipe 버전)');
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

      // MediaPipe Hands 초기화 (아직 로드되지 않은 경우)
      if (!this.isInitialized) {
        await this.initializeMediaPipe();
      }

      // 카메라 스트림 요청 (최적화된 옵션)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: "user",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false
      });

      this.stream = stream;
      console.log('카메라 스트림 연결 성공');

      // Canvas 설정
      this.setupCanvas();

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

  async initializeMediaPipe() {
    try {
      console.log('MediaPipe Hands 초기화 시작');

      // MediaPipe Hands 스크립트 동적 로드 (개선된 버전)
      if (!window.Hands) {
        await this.loadMediaPipeScript();
        // 스크립트 로드 후 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Hands가 로드되었는지 확인
      if (!window.Hands) {
        throw new Error('MediaPipe Hands 라이브러리가 로드되지 않았습니다');
      }

      // 기존 Hands 인스턴스 정리
      if (this.hands) {
        try {
          this.hands.close();
        } catch (e) {
          console.warn('기존 Hands 인스턴스 정리 실패:', e);
        }
      }

      // Hands 인스턴스 생성
      this.hands = new window.Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
        },
      });

      // Hands 옵션 설정 (개선된 옵션)
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,  // 정확도 향상
        minTrackingConfidence: 0.6,   // 추적 정확도 향상
        selfieMode: true,              // 셀피 모드 활성화
      });

      // 결과 처리 콜백 설정
      this.hands.onResults((results) => {
        this.onHandResults(results);
      });

      // 초기화 완료 대기
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MediaPipe 초기화 타임아웃'));
        }, 5000);

        // 간단한 테스트로 초기화 확인
        this.hands.send({ image: new ImageData(1, 1) }).then(() => {
          clearTimeout(timeout);
          resolve();
        }).catch(reject);
      });

      this.isInitialized = true;
      console.log('MediaPipe Hands 초기화 완료');

    } catch (error) {
      console.error('MediaPipe 초기화 실패:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async loadMediaPipeScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('MediaPipe 스크립트 로드 실패'));
      document.head.appendChild(script);
    });
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

    // 영구적인 video 요소 생성
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.width = 640;
      this.video.height = 480;
      this.video.style.display = 'none';
      document.body.appendChild(this.video);
      console.log('영구적인 video 요소 생성됨');
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

    // 실시간 프레임 처리 시작
    this.processFrame();
  }

  async processFrame() {
    if (!this.stream || !this.hands || !this.video) {
      return;
    }

    // 이미 프레임 처리 중이면 중복 실행 방지
    if (this.isProcessingFrame) {
      requestAnimationFrame(() => this.processFrame());
      return;
    }

    this.isProcessingFrame = true;

    try {
      // 영구적인 video 요소 사용
      if (this.video.srcObject !== this.stream) {
        this.video.srcObject = this.stream;
      }

      // video가 준비되지 않은 경우 대기
      if (this.video.readyState < 2) {
        this.video.addEventListener('loadeddata', () => {
          this.processFrame();
        }, { once: true });
        this.isProcessingFrame = false;
        return;
      }

      // MediaPipe에 프레임 전달
      await this.hands.send({ image: this.video });

      // 다음 프레임 처리
      requestAnimationFrame(() => {
        this.isProcessingFrame = false;
        this.processFrame();
      });

    } catch (error) {
      console.error('프레임 처리 오류:', error);
      this.isProcessingFrame = false;

      // 1초 후 재시도
      setTimeout(() => this.processFrame(), 1000);
    }
  }

  onHandResults(results) {
    try {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness[0];

        // 정확한 손가락 개수 세기
        const fingerCount = this.countExtendedFingers(landmarks);

        // 제스처 분석 및 실행
        const gesture = this.analyzeGesture(fingerCount, landmarks);

        if (gesture && gesture !== this.lastGesture) {
          this.lastGesture = gesture;
          this.handleGesture(gesture);
        }

        // 팝업에 실시간 상태 전송
        this.sendGestureStatus({
          gesture: gesture,
          fingerCount: fingerCount,
          confidence: results.multiHandedness[0]?.score || 0,
          landmarks: landmarks,
          timestamp: Date.now()
        });

      } else {
        // 손이 감지되지 않음
        if (this.lastGesture) {
          this.lastGesture = null;
          this.sendGestureStatus({
            gesture: null,
            fingerCount: 0,
            confidence: 0,
            landmarks: null,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('손 결과 처리 오류:', error);
    }
  }

  countExtendedFingers(landmarks) {
    // MediaPipe 손 랜드마크를 사용한 개선된 손가락 개수 세기
    const fingerTips = [4, 8, 12, 16, 20];    // 손가락 끝
    const fingerPips = [3, 6, 10, 14, 18];    // 첫 번째 관절
    const fingerMcp = [2, 5, 9, 13, 17];      // 손가락 뿌리 (새로 추가)

    let extendedFingers = 0;
    const fingerStates = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false
    };

    // 손의 방향 계산 (손목에서 중지까지의 벡터)
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const handDirection = {
      x: middleMcp.x - wrist.x,
      y: middleMcp.y - wrist.y
    };

    // 손의 방향이 오른손인지 왼손인지 판단
    const isRightHand = handDirection.x > 0;

    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPips[i]];
      const mcp = landmarks[fingerMcp[i]];

      let isExtended = false;

      if (i === 0) {
        // 엄지: 손 방향에 따라 다른 기준 적용
        if (isRightHand) {
          // 오른손: 엄지가 왼쪽으로 펴진 경우
          isExtended = tip.x < pip.x - 0.02; // 임계값 조정
        } else {
          // 왼손: 엄지가 오른쪽으로 펴진 경우
          isExtended = tip.x > pip.x + 0.02; // 임계값 조정
        }

        // 추가 조건: 엄지가 MCP보다 충분히 떨어져 있는지 확인
        const distanceFromMcp = Math.sqrt(
          Math.pow(tip.x - mcp.x, 2) + Math.pow(tip.y - mcp.y, 2)
        );
        isExtended = isExtended && distanceFromMcp > 0.08;

      } else {
        // 검지, 중지, 약지, 소지
        // PIP와 TIP 사이의 거리가 충분한지 확인 (펴진 정도)
        const pipToTipDistance = Math.sqrt(
          Math.pow(tip.x - pip.x, 2) + Math.pow(tip.y - pip.y, 2)
        );

        // MCP와 TIP의 y좌표 차이로 기본적인 펴짐 판단
        const verticalDistance = Math.abs(tip.y - mcp.y);

        // 두 조건을 모두 만족해야 펴진 것으로 판단
        isExtended = pipToTipDistance > 0.06 && verticalDistance > 0.08;
      }

      if (isExtended) {
        extendedFingers++;
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        fingerStates[fingerNames[i]] = true;
      }
    }

    // 상태 저장
    this.fingerStates = fingerStates;

    return extendedFingers;
  }

  analyzeGesture(fingerCount, landmarks) {
    // 개선된 손가락 개수 기반 스마트 제스처 분석
    const gesture = this.classifyGesture(fingerCount, landmarks);

    // 제스처 히스토리 업데이트 (안정성 향상)
    this.updateGestureHistory(gesture);

    // 히스토리를 기반으로 안정적인 제스처 결정
    return this.getStableGesture();
  }

  classifyGesture(fingerCount, landmarks) {
    switch (fingerCount) {
      case 0:
        return 'fist'; // 주먹

      case 1:
        // 어떤 손가락이 펴져있는지 확인
        if (this.fingerStates.index) {
          // 검지만 펴진 경우: 엄지와의 거리로 구분
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
          );

          if (distance > 0.15) {
            return 'one_finger'; // 멀리 떨어진 검지
          } else {
            return 'thumb_index'; // 엄지와 가까운 검지
          }
        }
        if (this.fingerStates.thumb) return 'thumb_only';
        return 'one_finger';

      case 2:
        if (this.fingerStates.index && this.fingerStates.middle) {
          // V자 모양인지 확인 (평화 제스처)
          const indexTip = landmarks[8];
          const middleTip = landmarks[12];
          const distance = Math.sqrt(
            Math.pow(indexTip.x - middleTip.x, 2) + Math.pow(indexTip.y - middleTip.y, 2)
          );

          if (distance > 0.12) {
            return 'peace'; // 평화 제스처
          }
        }
        return 'two_fingers';

      case 3:
        if (this.fingerStates.index && this.fingerStates.middle && this.fingerStates.ring) {
          return 'three_fingers';
        }
        return 'three_fingers';

      case 4:
        // 네 손가락이 모두 펴진 경우
        if (this.fingerStates.index && this.fingerStates.middle &&
            this.fingerStates.ring && this.fingerStates.pinky) {
          return 'four_fingers';
        }
        return 'four_fingers';

      case 5:
        return 'open_hand'; // 손바닥 펼침

      default:
        return null;
    }
  }

  updateGestureHistory(gesture) {
    // 제스처 히스토리 유지 (최근 5개)
    this.gestureHistory.push({
      gesture: gesture,
      timestamp: Date.now()
    });

    if (this.gestureHistory.length > 5) {
      this.gestureHistory.shift();
    }
  }

  getStableGesture() {
    if (this.gestureHistory.length < 3) {
      return this.gestureHistory[this.gestureHistory.length - 1]?.gesture || null;
    }

    // 최근 3개의 제스처 중 가장 많이 나온 제스처 반환
    const recentGestures = this.gestureHistory.slice(-3);
    const gestureCount = {};

    recentGestures.forEach(item => {
      if (item.gesture) {
        gestureCount[item.gesture] = (gestureCount[item.gesture] || 0) + 1;
      }
    });

    // 가장 많이 나온 제스처 찾기
    let maxCount = 0;
    let stableGesture = null;

    for (const [gesture, count] of Object.entries(gestureCount)) {
      if (count > maxCount) {
        maxCount = count;
        stableGesture = gesture;
      }
    }

    // 2번 이상 나온 경우에만 안정적인 제스처로 인정
    return maxCount >= 2 ? stableGesture : recentGestures[recentGestures.length - 1].gesture;
  }

  handleGesture(gestureType) {
    const now = Date.now();

    // 제스처 쿨다운 (너무 빠른 반복 방지) - 조정 가능
    if (now - this.lastGestureTime < 800) {  // 800ms로 단축
      return;
    }

    this.lastGestureTime = now;

    let scrollAction = null;

    // 개선된 제스처 매핑 - 더 직관적으로
    switch (gestureType) {
      case 'fist':
        scrollAction = { action: 'SCROLL_UP', speed: 300 };  // 위로
        break;

      case 'one_finger':
        scrollAction = { action: 'SCROLL_TOP' };  // 맨 위로
        break;

      case 'thumb_only':
        scrollAction = { action: 'SCROLL_TOP' };  // 맨 위로
        break;

      case 'peace':
        scrollAction = { action: 'SCROLL_DOWN', speed: 300 };  // 아래로
        break;

      case 'two_fingers':
        scrollAction = { action: 'SCROLL_BOTTOM' };  // 맨 아래로
        break;

      case 'three_fingers':
        scrollAction = { action: 'SCROLL_DOWN', speed: 500 };  // 빠르게 아래로
        break;

      case 'four_fingers':
        scrollAction = { action: 'SCROLL_BOTTOM' };  // 맨 아래로
        break;

      case 'open_hand':
        scrollAction = { action: 'SCROLL_DOWN', speed: 200 };  // 천천히 아래로
        break;

      case 'thumb_index':
        scrollAction = { action: 'SCROLL_UP', speed: 200 };  // 천천히 위로
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
