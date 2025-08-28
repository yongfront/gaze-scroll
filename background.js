// 브라우저 확장프로그램 백그라운드 스크립트
// 모든 탭의 스크롤을 제어하는 중앙 컨트롤러

class TabScrollController {
  constructor() {
    this.activeTabId = null;
    this.isControlling = false;
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'START_CONTROL':
          await this.startScrollControl();
          sendResponse({ success: true });
          break;

        case 'STOP_CONTROL':
          await this.stopScrollControl();
          sendResponse({ success: true });
          break;

        case 'SCROLL_UP':
          await this.scrollActiveTab('up', request.speed || 150);
          sendResponse({ success: true });
          break;

        case 'SCROLL_DOWN':
          await this.scrollActiveTab('down', request.speed || 150);
          sendResponse({ success: true });
          break;

        case 'SCROLL_TOP':
          await this.scrollActiveTab('top');
          sendResponse({ success: true });
          break;

        case 'SCROLL_BOTTOM':
          await this.scrollActiveTab('bottom');
          sendResponse({ success: true });
          break;

        case 'GET_ACTIVE_TAB':
          const activeTab = await this.getActiveTab();
          sendResponse({ activeTab });
          break;

        case 'CAMERA_STARTED':
          console.log('카메라 스트림 시작됨:', request.streamId);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('TabScrollController error:', error);
      sendResponse({ error: error.message });
    }
  }

  async startScrollControl() {
    this.isControlling = true;
    console.log('다른 탭 스크롤 제어 시작');

    // 모든 탭에 content script 주입
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith('http')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (error) {
          console.log(`탭 ${tab.id}에 content script 주입 실패:`, error);
        }
      }
    }
  }

  async stopScrollControl() {
    this.isControlling = false;
    console.log('다른 탭 스크롤 제어 중지');
  }

  async scrollActiveTab(direction, speed = 150) {
    if (!this.isControlling) return;

    try {
      const activeTab = await this.getActiveTab();
      if (!activeTab) return;

      // content script에 스크롤 명령 전송
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'SCROLL',
        direction: direction,
        speed: speed
      });

    } catch (error) {
      console.error('스크롤 명령 전송 실패:', error);
    }
  }

  async getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
}

// 컨트롤러 초기화
const controller = new TabScrollController();

console.log('손 제스처 스크롤 컨트롤러 백그라운드 스크립트 로드됨');
