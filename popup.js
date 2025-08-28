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
          } else if (message.action === 'GESTURE_STATUS_UPDATE') {
            // 실시간 제스처 상태 업데이트
            this.updateGestureStatus(message.status);
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

    // Content Script에서 실시간으로 제스처 상태를 받으므로
    // 여기서는 별도의 타이머가 필요 없음
    // updateGestureStatus 메소드에서 실시간 업데이트 처리
  }

  updateGestureStatus(status) {
    if (!status) return;

    const { gesture, fingerCount, confidence } = status;

    // 제스처 이름 매핑
    const gestureNames = {
      'fist': '✊ 주먹',
      'one_finger': '☝️ 한 손가락',
      'thumb_only': '👍 엄지',
      'peace': '✌️ 평화',
      'two_fingers': '✌️ 두 손가락',
      'three_fingers': '🤟 세 손가락',
      'four_fingers': '🤟 네 손가락',
      'open_hand': '🖐️ 손바닥',
      null: '손을 보여주세요 👋'
    };

    // 팝업의 제스처 인디케이터 업데이트
    if (this.gestureIndicator) {
      if (gesture) {
        this.gestureIndicator.textContent = `${gestureNames[gesture]} (${fingerCount}개)`;
        this.gestureIndicator.style.color = '#4CAF50';
        this.gestureIndicator.style.fontWeight = 'bold';
      } else {
        this.gestureIndicator.textContent = gestureNames[null];
        this.gestureIndicator.style.color = '#666';
        this.gestureIndicator.style.fontWeight = 'normal';
      }
    }

    // 상태 표시줄 업데이트
    if (this.statusText && gesture) {
      this.statusText.textContent = `제스처 감지: ${gestureNames[gesture]}`;
      this.statusText.style.color = '#4CAF50';
    }

    // 디버그 정보 (콘솔)
    console.log(`제스처 상태: ${gesture || '없음'} | 손가락: ${fingerCount}개 | 정확도: ${(confidence * 100).toFixed(1)}%`);
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
