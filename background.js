// Gaze Scroll Background Script
chrome.runtime.onInstalled.addListener(function() {
  console.log('Gaze Scroll 확장 프로그램이 설치되었습니다.');

  // 기본 설정 초기화
  chrome.storage.sync.get(['gazeScrollSettings'], function(result) {
    if (!result.gazeScrollSettings) {
      chrome.storage.sync.set({
        gazeScrollSettings: {
          scrollSpeed: 50,
          topZone: 30,
          bottomZone: 30,
          debugMode: false
        }
      });
    }
  });
});

// 탭이 업데이트될 때 content script에 메시지 전달
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, {
      action: 'tabUpdated'
    });
  }
});

// content script로부터 디버그 메시지를 받아 popup으로 전달
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'debugUpdate') {
    // 모든 popup으로 디버그 정보 브로드캐스트 (응답 대기 없이)
    try {
      chrome.runtime.sendMessage(message).catch((error) => {
        // popup이 닫혔거나 없는 경우 무시 (정상적인 상황)
        if (!error.message.includes('Receiving end does not exist')) {
          console.warn('디버그 정보 브로드캐스트 실패:', error.message);
        }
      });
    } catch (error) {
      console.warn('디버그 메시지 브로드캐스트 중 오류:', error);
    }

    // 즉시 응답 (메시지 채널 닫힘 방지)
    sendResponse({ ok: true });
    return false; // 동기 응답
  }
  
  // 다른 메시지 타입들도 즉시 응답
  if (message.action === 'notify') {
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // popup이 없어도 정상
      });
    } catch (error) {
      console.warn('알림 메시지 브로드캐스트 중 오류:', error);
    }
    
    sendResponse({ ok: true });
    return false; // 동기 응답
  }
  
  // 알 수 없는 메시지
  sendResponse({ ok: false, error: 'Unknown message action' });
  return false;
});
