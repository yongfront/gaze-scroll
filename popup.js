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

        // Content Script에 카메라 중지 요청
        chrome.runtime.sendMessage({ action: 'STOP_CAMERA_IN_CONTENT' });
      }
    } catch (error) {
      console.error('제어 중지 실패:', error);
    }
  }

  stopCamera() {
    // 카메라 컨테이너 숨기기
    this.cameraContainer.style.display = 'none';

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

      // Content Script에 카메라 시작 요청
      chrome.runtime.sendMessage({
        action: 'START_CAMERA_IN_CONTENT'
      });

      console.log('카메라 시작 요청 전송됨');

      // 카메라 컨테이너 표시
      this.cameraContainer.style.display = 'block';
      this.gestureIndicator.textContent = '카메라 준비 중...';

      // Content Script의 응답 대기 (한 번만 등록)
      if (!this.messageListenerAdded) {
        chrome.runtime.onMessage.addListener((message) => {
          if (message.action === 'CAMERA_READY') {
            console.log('카메라 준비 완료');
            this.gestureIndicator.textContent = '손을 보여주세요 👋';
            this.startGestureDetection();
          } else if (message.action === 'CAMERA_ERROR') {
            console.error('카메라 오류:', message.error);
            this.showError(message.error);
            this.showCameraRetryButton();
          }
        });
        this.messageListenerAdded = true;
      }

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
    console.log('제스처 감지 UI 시작');

    // 제스처 감지 타이머 시작 (UI 표시용)
    this.gestureTimer = setInterval(() => {
      if (this.isControlling) {
        // Content Script에서 제스처를 처리하므로 여기서는 UI만 업데이트
        // 실제로는 Content Script의 메시지를 받아서 표시
      }
    }, 1000);
  }



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
      // Content Script에 카메라 재시작 요청
      chrome.runtime.sendMessage({ action: 'START_CAMERA_IN_CONTENT' });

      console.log('카메라 재요청 성공');

      // 성공 시 버튼 숨기기
      this.hideCameraRetryButton();

      // 에러 메시지 초기화
      this.statusText.textContent = '카메라 권한 허용됨!';
      this.statusText.style.color = '#4CAF50';

      // 카메라 컨테이너 표시
      this.cameraContainer.style.display = 'block';
      this.gestureIndicator.textContent = '카메라 준비 중...';

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
