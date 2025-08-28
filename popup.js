// 팝업 인터페이스 스크립트
// 시뮬레이션 모드: 실제 카메라 없이 제스처 버튼으로 테스트

class PopupController {
  constructor() {
    this.isControlling = false;
    this.initializeElements();
    this.setupEventListeners();
    this.updateCurrentTab();
  }

  initializeElements() {
    this.controlButton = document.getElementById('controlButton');
    this.stopButton = document.getElementById('stopButton');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.currentTab = document.getElementById('currentTab');
  }

  setupEventListeners() {
    this.controlButton.addEventListener('click', () => this.startControl());
    this.stopButton.addEventListener('click', () => this.stopControl());
  }

  async startControl() {
    try {
      // 백그라운드 스크립트에 제어 시작 명령 전송
      const response = await chrome.runtime.sendMessage({ action: 'START_CONTROL' });

      if (response.success) {
        this.isControlling = true;
        this.updateUI(true);
        console.log('스크롤 제어 시작됨 (시뮬레이션 모드)');

        // Content Script에 제스처 시뮬레이션 시작 요청
        chrome.runtime.sendMessage({ action: 'START_GESTURE_SIMULATION' });
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
        console.log('스크롤 제어 중지됨');

        // Content Script에 제스처 시뮬레이션 중지 요청
        chrome.runtime.sendMessage({ action: 'STOP_GESTURE_SIMULATION' });
      }
    } catch (error) {
      console.error('제어 중지 실패:', error);
    }
  }

  updateUI(isActive) {
    if (isActive) {
      this.controlButton.style.display = 'none';
      this.stopButton.style.display = 'block';
      this.statusDot.className = 'status-dot active';
      this.statusText.textContent = '제어 중 🤖 (시뮬레이션)';
    } else {
      this.controlButton.style.display = 'block';
      this.stopButton.style.display = 'none';
      this.statusDot.className = 'status-dot inactive';
      this.statusText.textContent = '대기 중 (시뮬레이션 모드)';
    }
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
      statusText.textContent = '대기 중 (시뮬레이션 모드)';
      statusText.style.color = '';
    }, 5000);
  }
}

// 팝업 초기화
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

console.log('손 제스처 스크롤 컨트롤러 팝업 로드됨');
