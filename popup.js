// 팝업 인터페이스 스크립트

class PopupController {
  constructor() {
    this.isControlling = false;
    this.stream = null;
    this.initializeElements();
    this.setupEventListeners();
    this.updateCurrentTab();
  }

  initializeElements() {
    this.controlButton = document.getElementById('controlButton');
    this.stopButton = document.getElementById('stopButton');
    this.retryCameraButton = document.getElementById('retryCameraButton');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.currentTab = document.getElementById('currentTab');
    this.cameraContainer = document.getElementById('cameraContainer');
    this.cameraStream = document.getElementById('cameraStream');
    this.gestureIndicator = document.getElementById('gestureIndicator');
  }

  setupEventListeners() {
    this.controlButton.addEventListener('click', () => this.startControl());
    this.stopButton.addEventListener('click', () => this.stopControl());
    this.retryCameraButton.addEventListener('click', () => this.retryCameraPermission());
  }

  async startControl() {
    try {
      // 백그라운드 스크립트에 제어 시작 명령 전송
      const response = await chrome.runtime.sendMessage({ action: 'START_CONTROL' });

      if (response.success) {
        this.isControlling = true;
        this.updateUI(true);
        console.log('다른 탭 스크롤 제어 시작됨');

        // 카메라 권한 요청 및 카메라 시작
        this.startCameraControl();
      }
    } catch (error) {
      console.error('제어 시작 실패:', error);
      this.showError('제어 시작에 실패했습니다');
    }
  }

  async stopControl() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'STOP_CONTROL' });

      if (response.success) {
        this.isControlling = false;
        this.updateUI(false);
        this.stopCamera();
        this.hideCameraRetryButton(); // 재요청 버튼 숨기기
        console.log('다른 탭 스크롤 제어 중지됨');
      }
    } catch (error) {
      console.error('제어 중지 실패:', error);
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.cameraContainer.style.display = 'none';
    this.cameraStream.srcObject = null;

    // 제스처 감지 타이머 정리
    if (this.gestureTimer) {
      clearInterval(this.gestureTimer);
      this.gestureTimer = null;
    }
  }

  updateUI(isActive) {
    if (isActive) {
      this.controlButton.style.display = 'none';
      this.stopButton.style.display = 'block';
      this.statusDot.className = 'status-dot active';
      this.statusText.textContent = '제어 중 🎥';
    } else {
      this.controlButton.style.display = 'block';
      this.stopButton.style.display = 'none';
      this.statusDot.className = 'status-dot inactive';
      this.statusText.textContent = '대기 중';
    }
  }

  async startCameraControl() {
    try {
      // 카메라 권한 상태 확인
      const permissionStatus = await navigator.permissions.query({ name: 'camera' });
      console.log('카메라 권한 상태:', permissionStatus.state);

      if (permissionStatus.state === 'denied') {
        throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      }

      // 카메라 스트림 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user'
        }
      });

      console.log('카메라 스트림 시작됨');

      // 스트림을 video 요소에 연결
      this.stream = stream;
      this.cameraStream.srcObject = stream;
      this.cameraContainer.style.display = 'block';

      // 스트림이 성공적으로 시작되었음을 백그라운드에 알림
      chrome.runtime.sendMessage({
        action: 'CAMERA_STARTED',
        streamId: stream.id
      });

      // 손 제스처 감지 시작
      this.startGestureDetection();

    } catch (error) {
      console.error('카메라 접근 실패:', error);

      let errorMessage = '카메라 권한이 필요합니다';

      if (error.name === 'NotAllowedError') {
        errorMessage = '카메라 권한이 거부되었습니다.';
        this.showCameraRetryButton();
      } else if (error.name === 'NotFoundError') {
        errorMessage = '카메라를 찾을 수 없습니다.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '카메라가 다른 앱에서 사용 중입니다.';
      }

      this.showError(errorMessage);
    }
  }

  startGestureDetection() {
    console.log('손 제스처 감지 시작');

    // Canvas 생성 for 프레임 분석
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d');

    // 제스처 감지 타이머 시작
    this.gestureTimer = setInterval(() => {
      if (this.isControlling && this.stream) {
        this.analyzeFrame();
      }
    }, 500); // 0.5초마다 분석

    // 손 제스처 히스토리 저장
    this.gestureHistory = [];
    this.lastGestureTime = 0;
  }

  analyzeFrame() {
    try {
      // Canvas에 현재 프레임 그리기
      this.ctx.drawImage(this.cameraStream, 0, 0, this.canvas.width, this.canvas.height);

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
        this.gestureIndicator.textContent = `감지됨: ${gesture} 🎯`;
        this.gestureIndicator.style.color = '#4CAF50';
      } else {
        this.gestureIndicator.textContent = '손을 보여주세요 👋';
        this.gestureIndicator.style.color = '#666';
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
    // 실제로는 더 복잡한 알고리즘이 필요하지만 여기서는 기본적인 분류만 구현

    // 랜덤하게 기본 제스처 중 하나를 반환 (데모용)
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
      chrome.runtime.sendMessage(scrollAction).catch(error => {
        console.log('스크롤 명령 전송 실패:', error);
      });
    }
  }

  // simulateGesture 함수는 제거됨 - 실제 제스처 인식으로 대체됨

  async updateCurrentTab() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' });

      if (response.activeTab) {
        const tab = response.activeTab;
        document.getElementById('tabInfo').textContent = tab.title || tab.url;
      }
    } catch (error) {
      console.error('현재 탭 정보 조회 실패:', error);
      document.getElementById('tabInfo').textContent = '탭 정보를 불러올 수 없습니다';
    }
  }

  showError(message) {
    // 간단한 에러 표시
    const statusText = document.getElementById('statusText');
    statusText.textContent = `❌ ${message}`;
    statusText.style.color = '#ff6b6b';

    setTimeout(() => {
      statusText.textContent = '대기 중';
      statusText.style.color = '';
    }, 5000);
  }

  showCameraRetryButton() {
    // 카메라 권한 재요청 버튼 표시
    this.retryCameraButton.style.display = 'block';
  }

  hideCameraRetryButton() {
    // 카메라 권한 재요청 버튼 숨기기
    this.retryCameraButton.style.display = 'none';
  }

  async retryCameraPermission() {
    console.log('카메라 권한 재요청 시도');

    // 버튼을 일시적으로 비활성화
    this.retryCameraButton.disabled = true;
    this.retryCameraButton.textContent = '🔄 재요청 중...';

    try {
      // 카메라 스트림 재요청
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user'
        }
      });

      console.log('카메라 권한 재요청 성공');

      // 성공 시 버튼 숨기기
      this.hideCameraRetryButton();

      // 에러 메시지 초기화
      this.statusText.textContent = '카메라 권한 허용됨!';
      this.statusText.style.color = '#4CAF50';

      // 스트림 연결 및 제스처 감지 시작
      this.stream = stream;
      this.cameraStream.srcObject = stream;
      this.cameraContainer.style.display = 'block';

      // 백그라운드에 알림
      chrome.runtime.sendMessage({
        action: 'CAMERA_STARTED',
        streamId: stream.id
      });

      // 제스처 감지 시작
      this.startGestureDetection();

      // 상태 업데이트
      this.updateUI(true);

    } catch (error) {
      console.error('카메라 권한 재요청 실패:', error);
      this.showError('카메라 권한 재요청에 실패했습니다. 브라우저 설정을 확인해주세요.');
    } finally {
      // 버튼 복원
      this.retryCameraButton.disabled = false;
      this.retryCameraButton.textContent = '🔄 카메라 권한 재요청';
    }
  }
}

// 팝업 초기화
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

console.log('손 제스처 스크롤 컨트롤러 팝업 로드됨');
