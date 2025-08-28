// Gaze Scroll Popup Script

// 기존에 선언된 변수/함수들을 정리하여 중복 선언 방지
(function() {
  // 이미 선언된 전역 변수들을 정리
  const globalVarsToClean = ['midaEventObserver', 'postIntegrationStatus'];

  globalVarsToClean.forEach(varName => {
    if (typeof window[varName] !== 'undefined') {
      console.warn(`기존에 선언된 ${varName} 변수를 정리합니다.`);
      delete window[varName];
    }
  });
})();

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const calibrateBtn = document.getElementById('calibrateBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const scrollSpeed = document.getElementById('scrollSpeed');
  const topZone = document.getElementById('topZone');
  const bottomZone = document.getElementById('bottomZone');
  // debugMode 체크 박스 제거됨 - 항상 디버그 모드로 작동
  const debugPanel = document.getElementById('debugPanel');
  const debugVideo = document.getElementById('debugVideo');
  const debugCanvas = document.getElementById('debugCanvas');
  const gazePosition = document.getElementById('gazePosition');
  const brightnessDiff = document.getElementById('brightnessDiff');
  const scrollDirection = document.getElementById('scrollDirection');
  const acceleration = document.getElementById('acceleration');
  // 줌 기능 제거됨 - 1배율 고정
  // mirrorMode 제거됨 - 항상 반전 모드로 고정
  const recenterEyes = document.getElementById('recenterEyes');
  const eyeTrackingStatus = document.getElementById('eyeTrackingStatus');
  const calibrationProgress = document.getElementById('calibrationProgress');
  const debugPanelContainer = document.getElementById('debugPanelContainer');

  // 새로운 디버그 요소들
  const faceDetectionStatus = document.getElementById('faceDetectionStatus');
  const eyeTrackingQuality = document.getElementById('eyeTrackingQuality');
  const topBrightness = document.getElementById('topBrightness');
  const bottomBrightness = document.getElementById('bottomBrightness');
  const eyeDistance = document.getElementById('eyeDistance');
  const leftEyeConfidence = document.getElementById('leftEyeConfidence');
  const rightEyeConfidence = document.getElementById('rightEyeConfidence');
  const skinPixels = document.getElementById('skinPixels');

  let isActive = false;

  // 저장된 설정 불러오기
  loadSettings();

  // 디버그 모드를 항상 활성화로 설정
  setTimeout(() => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setDebugMode',
        enabled: true
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('디버그 모드 강제 활성화 오류:', chrome.runtime.lastError);
        } else {
          console.log('✅ 디버그 모드 강제 활성화됨');
        }
      });
    });
  }, 500);

  // 팝업에서는 카메라를 직접 열지 않고, Content Script에서 전달되는 프레임만 표시
  // 초기에는 로딩 메시지만 표시
  setTimeout(() => {
    const loadingElement = document.getElementById('cameraLoading');
    if (loadingElement) {
      loadingElement.innerHTML = '📷 카메라 연결 확인중...';
      loadingElement.style.display = 'block';
      loadingElement.style.color = 'rgba(255,255,255,0.9)';
    }
  }, 500);

  // 카메라 상태 확인 요청
  setTimeout(() => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getStatus'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('카메라 상태 확인 실패:', chrome.runtime.lastError);
          const loadingElement = document.getElementById('cameraLoading');
          if (loadingElement) {
            loadingElement.innerHTML = '⚠️ 페이지를 새로고침 후 시도해주세요';
            loadingElement.style.color = 'rgba(255,200,100,0.9)';
          }
        } else if (response && response.isActive) {
          console.log('카메라가 이미 활성화되어 있음');
          const loadingElement = document.getElementById('cameraLoading');
          if (loadingElement) {
            loadingElement.innerHTML = '📷 프레임 수신 대기중...';
          }
        }
      });
    });
  }, 1000);

  // 확장 프로그램 연결 상태 모니터링
  let lastMessageTime = Date.now();
  let connectionLost = false;

  // 주기적으로 연결 상태 확인
  setInterval(() => {
    const currentTime = Date.now();
    const timeSinceLastMessage = currentTime - lastMessageTime;

    // 5초 이상 메시지가 오지 않으면 연결이 끊어졌다고 판단 (더 빠른 감지)
    if (timeSinceLastMessage > 5000 && !connectionLost) {
      connectionLost = true;
      console.warn('Content Script과의 연결이 끊어졌습니다.');
      
      const loadingElement = document.getElementById('cameraLoading');
      if (loadingElement) {
        loadingElement.innerHTML = '🔄 연결 재시도 중... 카메라를 시작해주세요';
        loadingElement.style.color = 'rgba(255,200,100,0.9)';
        loadingElement.style.display = 'block';
      }
      
      showTopNotification('🔄 연결 복원 시도 중... 시선 추적을 다시 시작해주세요.', 4000);
    }
  }, 5000);

  // 메시지 수신 시 마지막 메시지 시간 업데이트
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'debugUpdate') {
      lastMessageTime = Date.now();
      if (connectionLost) {
        connectionLost = false;
        console.log('Content Script과의 연결이 복원되었습니다.');
        showTopNotification('✅ 연결이 복원되었습니다!', 2000);
      }
      updateDebugInfo(message.data);
      
      // 즉시 동기 응답 (메시지 채널 닫힘 방지)
      if (sendResponse) {
        sendResponse({ ok: true });
      }
      return false; // 동기 응답
    } else if (message.action === 'notify') {
      // Content Script에서 온 알림을 팝업 상단 알림으로 통일해서 표시
      try {
        const duration = typeof message.duration === 'number' ? message.duration : 3000;
        if (typeof window.showTopNotification === 'function') {
          window.showTopNotification(message.message || '', duration);
        }
        
        if (sendResponse) {
          sendResponse({ ok: true });
        }
        return false; // 동기 응답
      } catch (e) {
        console.error('notify 처리 중 오류:', e);
        if (sendResponse) {
          sendResponse({ ok: false, error: String(e) });
        }
        return false; // 동기 응답
      }
    }
    
    // 알 수 없는 메시지 타입
    if (sendResponse) {
      sendResponse({ ok: false, error: 'Unknown message type' });
    }
    return false; // 동기 응답
  });

  // 토글 버튼 이벤트
  toggleBtn.addEventListener('click', function() {
    isActive = !isActive;

          if (isActive) {
        startGazeTracking();
        // 시선 추적 시작 시 최상단 알림 표시
        setTimeout(() => {
          showTopNotification('👁️ 시선 추적이 시작되었습니다! 이제 눈을 움직여서 스크롤해보세요.', 4000);
        }, 1000);
      } else {
        stopGazeTracking();
        showTopNotification('⏸️ 시선 추적이 중지되었습니다.', 2000);
      }
  });

  // 보정 버튼 이벤트
  calibrateBtn.addEventListener('click', function() {
    calibrateEyes();
  });

  // 설정 변경 이벤트
  [scrollSpeed, topZone, bottomZone].forEach(input => {
    input.addEventListener('change', saveSettings);
  });

  // debugMode 이벤트 리스너 제거됨 - 항상 디버그 모드로 작동

  // 줌 기능 제거됨

  // 좌우 반전 모드 이벤트 제거됨 - 항상 반전 모드로 고정

  // 눈 중앙 맞추기 버튼 이벤트
  recenterEyes.addEventListener('click', function() {
    recenterEyeTracking();
  });

  // 상단 알림 클릭으로 닫기 (CSP 인라인 제거 대응)
  const topNotificationEl = document.getElementById('topNotification');
  if (topNotificationEl) {
    topNotificationEl.addEventListener('click', function() {
      if (typeof window.hideTopNotification === 'function') window.hideTopNotification();
    });
  }

  // 재시도 버튼 이벤트 바인딩 (CSP 인라인 제거 대응)
  const retryBtnEl = document.getElementById('retryCameraBtn');
  if (retryBtnEl) {
    retryBtnEl.addEventListener('click', function() {
      if (typeof window.retryCameraAccess === 'function') window.retryCameraAccess();
    });
    retryBtnEl.addEventListener('mouseenter', function() {
      retryBtnEl.style.transform = 'translateX(-50%) translateY(-2px)';
      retryBtnEl.style.boxShadow = '0 6px 25px rgba(52, 152, 219, 0.6)';
    });
    retryBtnEl.addEventListener('mouseleave', function() {
      retryBtnEl.style.transform = 'translateX(-50%)';
      retryBtnEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    });
  }

  function startGazeTracking() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startGazeTracking',
        settings: getSettings()
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('메시지 전송 오류:', chrome.runtime.lastError);
          updateUI(false);
          showError('메시지 전송에 실패했습니다. 페이지를 새로고침한 후 다시 시도해주세요.');
          return;
        }

        if (response && response.success) {
          updateUI(true);
        } else {
          updateUI(false);
          const errorMessage = response && response.error ? response.error : '카메라 권한을 확인해주세요.';
          showError('시선 추적을 시작할 수 없습니다. ' + errorMessage);
        }
      });
    });
  }

  function stopGazeTracking() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopGazeTracking'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('메시지 전송 오류:', chrome.runtime.lastError);
        }
      });
    });
    updateUI(false);
  }

  function calibrateEyes() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'calibrate'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('메시지 전송 오류:', chrome.runtime.lastError);
        }
      });
    });
  }

  function updateUI(active) {
    if (active) {
      toggleBtn.textContent = '시선 추적 중지';
      toggleBtn.classList.add('active');
      statusDot.classList.add('active');
      statusText.textContent = '활성화됨';
      calibrateBtn.disabled = false;
    } else {
      toggleBtn.textContent = '시선 추적 시작';
      toggleBtn.classList.remove('active');
      statusDot.classList.remove('active');
      statusText.textContent = '비활성화됨';
      calibrateBtn.disabled = true;
    }
  }

  function getSettings() {
    return {
      scrollSpeed: parseInt(scrollSpeed.value),
      topZone: parseInt(topZone.value),
      bottomZone: parseInt(bottomZone.value)
      // debugMode 제거됨 - 항상 디버그 모드로 작동
      // mirrorMode 제거됨 - 항상 반전 모드로 고정
      // zoomLevel 제거됨 - 1배율 고정
    };
  }

  function saveSettings() {
    const settings = getSettings();
    chrome.storage.sync.set({
      gazeScrollSettings: settings
    });
  }

  function loadSettings() {
    chrome.storage.sync.get(['gazeScrollSettings'], function(result) {
      if (result.gazeScrollSettings) {
        const settings = result.gazeScrollSettings;
        scrollSpeed.value = settings.scrollSpeed || 50;
        topZone.value = settings.topZone || 30;
        bottomZone.value = settings.bottomZone || 30;
        // debugMode 체크 박스 제거됨 - 항상 디버그 모드로 작동
        // mirrorMode 제거됨 - 항상 반전 모드로 고정
        // zoomLevel 제거됨 - 1배율 고정

        // 카메라 패널 항상 표시 (디버그 모드와 관계없이)
        debugPanelContainer.style.display = 'flex';
        debugPanel.style.display = 'block';
        setupDebugVideo();
      }
    });
  }

  // updateMirrorMode 함수 제거됨 - 항상 반전 모드로 고정

  function recenterEyeTracking() {
    // 눈 중앙 맞추기 요청
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'recenterEyes'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('눈 중앙 맞추기 오류:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('눈 중앙 맞추기 완료');
        }
      });
    });
  }

  // toggleDebugMode 함수 제거됨 - 항상 디버그 모드로 작동
  // Content Script에 디버그 모드 상태 전달 (항상 활성화)
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'setDebugMode',
      enabled: true
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('디버그 모드 설정 메시지 전송 오류:', chrome.runtime.lastError);
      }
    });
  });

  function showDebugInfo(message) {
    // 디버그 모드에서만 메시지 표시, 간단하게 표시
    console.log('디버그 메시지:', message);
    // 팝업 공간 절약을 위해 시각적 메시지는 생략
  }

  function setupDebugVideo() {
    console.log('=== 카메라 초기화 시작 ===');

    // 디버그 캔버스 설정
    if (debugCanvas) {
      debugCanvas.width = 200;
      debugCanvas.height = 150;
      console.log('캔버스 설정 완료:', debugCanvas.width, 'x', debugCanvas.height);
    } else {
      console.error('debugCanvas 요소를 찾을 수 없습니다!');
    }

    // 초기 로딩 메시지 표시
    showDebugInfo('카메라를 초기화하는 중...');

    // 디버그 정보 업데이트는 전역 리스너에서 처리됨

    // 팝업에서는 카메라를 직접 열지 않음. Content Script 프레임을 기다림
    const loadingElement = document.getElementById('cameraLoading');
    if (loadingElement) {
      loadingElement.innerHTML = '📷 프레임 대기중...';
      loadingElement.style.display = 'block';
      loadingElement.style.color = 'rgba(255,255,255,0.9)';
    }

    console.log('카메라 스트림 초기화 완료');
  }

  function startCameraStream() {
    // 더 이상 팝업에서 getUserMedia를 호출하지 않음
    const loadingElement = document.getElementById('cameraLoading');
    if (loadingElement) {
      loadingElement.innerHTML = '📷 프레임 대기중...';
      loadingElement.style.display = 'block';
      loadingElement.style.color = 'rgba(255,255,255,0.9)';
    }

    // 컨테이너 스타일 기본값으로 복원
    const cameraContainer = document.querySelector('.debug-video-container');
    if (cameraContainer) {
      cameraContainer.style.background = 'rgba(0, 0, 0, 0.5)';
      cameraContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }
  }

  function showDebugError(message) {
    // 카메라 오류는 콘솔에만 표시하고 팝업 공간 절약
    console.error('카메라 오류:', message);
    // 시각적 메시지는 표시하지 않음
  }

  function showRetryButton(message) {
    console.log('🔄 재시도 버튼 표시:', message);

    // 재시도 버튼만 표시 (메시지는 툴팁으로)
    const retryBtn = document.getElementById('retryCameraBtn');
    if (retryBtn) {
      retryBtn.style.display = 'block';
      retryBtn.title = message;

      // 애니메이션 효과로 나타나기
      setTimeout(() => {
        retryBtn.style.opacity = '1';
      }, 100);

      console.log('✅ 재시도 버튼 표시됨');
    } else {
      console.error('❌ 재시도 버튼을 찾을 수 없습니다!');
    }
  }

  // 디버깅용 함수들 - 이미 선언된 함수가 있으면 덮어쓰지 않도록 체크
  // 먼저 기존 함수들을 안전하게 정리
  const functionsToClean = [
    'checkCameraStatus', 'forceHideLoading', 'testCameraDisplay', 'retryCameraAccess',
    'showTopNotification', 'hideTopNotification', 'updateTopNotification',
    'notifyGazeTrackingReady', 'notifyFaceDetected', 'notifyCalibrationComplete',
    'notifyScrollDirection', 'showCameraPermissionGuide'
  ];

  functionsToClean.forEach(funcName => {
    if (typeof window[funcName] !== 'undefined') {
      console.log(`${funcName} 함수가 이미 존재합니다. 정리 후 재선언합니다.`);
      delete window[funcName];
    }
  });

  if (typeof window.checkCameraStatus === 'undefined') {
    window.checkCameraStatus = function() {
      const debugVideo = document.getElementById('debugVideo');
      const loadingElement = document.getElementById('cameraLoading');

      console.log('=== 카메라 상태 확인 ===');
      console.log('debugVideo 존재:', !!debugVideo);
      console.log('로딩 메시지 표시:', loadingElement ? loadingElement.style.display : '로딩 요소 없음');

      if (debugVideo) {
        console.log('비디오 상태:', {
          videoWidth: debugVideo.videoWidth,
          videoHeight: debugVideo.videoHeight,
          readyState: debugVideo.readyState,
          paused: debugVideo.paused,
          currentTime: debugVideo.currentTime,
          srcObject: debugVideo.srcObject ? '스트림 있음' : '스트림 없음',
          style: {
            display: debugVideo.style.display,
            visibility: debugVideo.style.visibility,
            opacity: debugVideo.style.opacity
          }
        });
      }

      return debugVideo;
    };
  }

  if (typeof window.forceHideLoading === 'undefined') {
    window.forceHideLoading = function() {
      const loadingElement = document.getElementById('cameraLoading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
        console.log('로딩 메시지 강제 숨김');
      }
    };
  }

  if (typeof window.testCameraDisplay === 'undefined') {
    window.testCameraDisplay = function() {
      console.log('=== 카메라 표시 테스트 시작 ===');

      // 로딩 메시지 숨기기
      if (window.forceHideLoading) window.forceHideLoading();

      // debugVideo 상태 확인
      const debugVideo = window.checkCameraStatus ? window.checkCameraStatus() : null;

      if (debugVideo && debugVideo.srcObject) {
        console.log('카메라 스트림이 연결되어 있음');

        // 비디오 재생 강제 시도
        if (debugVideo.paused) {
          debugVideo.play().then(() => {
            console.log('비디오 재생 강제 시작됨');
          }).catch(error => {
            console.error('비디오 재생 실패:', error);
          });
        }

        // 스타일 강제 설정
        debugVideo.style.display = 'block';
        debugVideo.style.visibility = 'visible';
        debugVideo.style.opacity = '1';
        debugVideo.style.zIndex = '10';

        console.log('비디오 스타일 강제 적용됨');
      } else {
        console.log('카메라 스트림이 연결되어 있지 않음');
      }

      return debugVideo;
    };
  }

  // 전역 함수로 재시도 함수 정의 - 중복 선언 방지
  if (typeof window.retryCameraAccess === 'undefined') {
    window.retryCameraAccess = function() {
      console.log('🔄 카메라 재시도 요청됨');

      // 먼저 카메라 권한 안내 표시
      if (window.showCameraPermissionGuide) window.showCameraPermissionGuide();

      const retryBtn = document.getElementById('retryCameraBtn');
      if (retryBtn) {
        // 애니메이션 효과로 사라지기
        retryBtn.style.opacity = '0';
        setTimeout(() => {
          retryBtn.style.display = 'none';
        }, 300);
        console.log('재시도 버튼 숨김 처리됨');
      }

      // 로딩 메시지 초기화
      const loadingElement = document.getElementById('cameraLoading');
      if (loadingElement) {
        loadingElement.innerHTML = '📹 권한 요청...';
        loadingElement.style.color = 'rgba(255,255,255,0.7)';
        loadingElement.style.display = 'block';
      }

      // 카메라 스트림 재시작 (약간 지연)
      setTimeout(() => {
        startCameraStream();
      }, 2000); // 권한 안내를 읽을 시간을 줌
    };
  }

  // 최상단 알림 메시지 제어 함수들 - 중복 선언 방지
  if (typeof window.showTopNotification === 'undefined') {
    window.showTopNotification = function(message, duration = 3000) {
      const notification = document.getElementById('topNotification');
      const textElement = document.getElementById('notificationText');

      if (notification && textElement) {
        textElement.textContent = message;
        notification.style.display = 'block';

        // 자동으로 사라지게 설정 (기본 3초)
        if (duration > 0) {
          setTimeout(() => {
            if (window.hideTopNotification) window.hideTopNotification();
          }, duration);
        }
      }
    };
  }

  if (typeof window.hideTopNotification === 'undefined') {
    window.hideTopNotification = function() {
      const notification = document.getElementById('topNotification');
      if (notification) {
        notification.style.display = 'none';
      }
    };
  }

  if (typeof window.updateTopNotification === 'undefined') {
    window.updateTopNotification = function(message) {
      const textElement = document.getElementById('notificationText');
      if (textElement) {
        textElement.textContent = message;
      }
    };
  }

  // 추가적인 알림 메시지들 - 중복 선언 방지
  if (typeof window.notifyGazeTrackingReady === 'undefined') {
    window.notifyGazeTrackingReady = function() {
      if (window.showTopNotification) window.showTopNotification('🎯 시선 추적이 준비되었습니다. 눈을 움직여서 스크롤을 테스트해보세요!', 3500);
    };
  }

  if (typeof window.notifyFaceDetected === 'undefined') {
    window.notifyFaceDetected = function() {
      if (window.showTopNotification) window.showTopNotification('👀 얼굴이 감지되었습니다!', 1500);
    };
  }

  if (typeof window.notifyCalibrationComplete === 'undefined') {
    window.notifyCalibrationComplete = function() {
      if (window.showTopNotification) window.showTopNotification('✅ 눈 위치 보정이 완료되었습니다!', 2500);
    };
  }

  if (typeof window.notifyScrollDirection === 'undefined') {
    window.notifyScrollDirection = function(direction) {
      const messages = {
        'up': '⬆️ 위쪽 스크롤 활성화',
        'down': '⬇️ 아래쪽 스크롤 활성화',
        'stop': '⏹️ 스크롤 정지'
      };
      const message = messages[direction] || '스크롤 방향 변경';
      if (window.showTopNotification) window.showTopNotification(message, 1000);
    };
  }

  // 카메라 권한 안내 함수 - 중복 선언 방지
  if (typeof window.showCameraPermissionGuide === 'undefined') {
    window.showCameraPermissionGuide = function() {
      const guideMessage = `
📹 카메라 권한 허용 방법:

1️⃣ 주소창 왼쪽 카메라 아이콘 클릭
   → 카메라 권한을 "허용"으로 설정

2️⃣ 브라우저 설정에서 직접 설정
   → chrome://settings/content/camera
   → Gaze Scroll에 카메라 권한 허용

3️⃣ 아래 🔄 재시도 버튼 클릭
   → 권한 재요청 팝업 표시

권한을 허용한 후 페이지를 새로고침해보세요!
      `;

      if (window.showTopNotification) window.showTopNotification(guideMessage, 0);
    };
  }

  function stopDebugVideo() {
    // 카메라 스트림 정지 (하지만 항상 켜두는 것이 좋으므로 실제로는 정지하지 않음)
    // 필요시 정지하려면 아래 주석을 해제
    /*
    if (debugVideo && debugVideo.srcObject) {
      debugVideo.srcObject.getTracks().forEach(track => track.stop());
      debugVideo.srcObject = null;
    }
    */

    // 디버그 비디오 배경 초기화
    if (debugVideo) {
      debugVideo.style.backgroundImage = 'none';
    }

    // 로딩 메시지 표시
    const loadingElement = document.getElementById('cameraLoading');
    if (loadingElement) {
      loadingElement.style.display = 'block';
      loadingElement.innerHTML = '📹 카메라 중지됨';
      loadingElement.style.color = 'rgba(255,255,255,0.5)';
    }

    // 메모리 정리
    if (debugCtx) {
      debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
      debugCtx = null;
    }
  }

  function updateDebugInfo(data) {
    // 기존 요소들 업데이트
    if (data.gazePosition !== undefined) {
      gazePosition.textContent = data.gazePosition;
    }
    if (data.brightnessDiff !== undefined) {
      const bd = Number(data.brightnessDiff);
      brightnessDiff.textContent = isFinite(bd) ? bd.toFixed(3) : '0.00';
    }
    if (data.scrollDirection !== undefined) {
      const directionText = data.scrollDirection === -1 ? '위로' :
                           data.scrollDirection === 1 ? '아래로' : '정지';
      scrollDirection.textContent = directionText;
    }
    if (data.acceleration !== undefined) {
      acceleration.textContent = data.acceleration.toFixed(1);
    }

    // 새로운 디버그 요소들 업데이트
    if (data.faceDetection && faceDetectionStatus) {
      faceDetectionStatus.textContent = data.faceDetection.message;
      faceDetectionStatus.style.color = data.faceDetection.confidence > 0.5 ? '#51cf66' : '#ffd43b';
    }

    if (data.eyeTracking && data.eyeTracking.quality && eyeTrackingQuality) {
      const quality = data.eyeTracking.quality;
      eyeTrackingQuality.textContent = quality.score.toFixed(2);
      eyeTrackingQuality.style.color =
        quality.status === 'good' ? '#51cf66' :
        quality.status === 'fair' ? '#ffd43b' : '#ff6b6b';
    }

    if (data.regions && topBrightness) {
      topBrightness.textContent = data.regions.top;
    }
    if (data.regions && bottomBrightness) {
      bottomBrightness.textContent = data.regions.bottom;
    }

    if (data.eyeTracking && data.eyeTracking.eyeDistance && eyeDistance) {
      eyeDistance.textContent = data.eyeTracking.eyeDistance;
    }

    if (data.eyeTracking && data.eyeTracking.regions && leftEyeConfidence) {
      const leftEye = data.eyeTracking.regions.leftEye;
      const rightEye = data.eyeTracking.regions.rightEye;

      if (leftEye) {
        leftEyeConfidence.textContent = leftEye.confidence;
        leftEyeConfidence.style.color = leftEye.confidence > 0.6 ? '#51cf66' :
                                       leftEye.confidence > 0.3 ? '#ffd43b' : '#ff6b6b';
      }

      if (rightEye) {
        rightEyeConfidence.textContent = rightEye.confidence;
        rightEyeConfidence.style.color = rightEye.confidence > 0.6 ? '#51cf66' :
                                        rightEye.confidence > 0.3 ? '#ffd43b' : '#ff6b6b';
      }
    }

    // 피부톤 픽셀 정보 업데이트
    if (data.currentFaceRegion && skinPixels) {
      const skinInfo = `${data.currentFaceRegion.skinPixels || 0}/${data.currentFaceRegion.totalSamples || 0} (${data.currentFaceRegion.skinPercentage || '0'}%)`;
      skinPixels.textContent = skinInfo;

      // 피부톤 픽셀이 충분한지 색상으로 표시
      const skinPercentage = parseFloat(data.currentFaceRegion.skinPercentage || '0');
      skinPixels.style.color = skinPercentage > 2 ? '#51cf66' :
                               skinPercentage > 1 ? '#ffd43b' : '#ff6b6b';
    } else if (skinPixels) {
      skinPixels.textContent = '0/0 (0%)';
      skinPixels.style.color = '#ff6b6b';
    }

    // 눈 추적 상태 표시 (기존)
    if (data.eyeTrackingState) {
      const state = data.eyeTrackingState;
      if (eyeTrackingStatus) {
        eyeTrackingStatus.textContent = state.isCalibrated ? '추적중' : '캘리브레이션';
        eyeTrackingStatus.style.color = state.isCalibrated ? '#51cf66' : '#ffd43b';
      }

      if (calibrationProgress) {
        calibrationProgress.textContent = `${state.calibrationFrames || 0}/30`;
        calibrationProgress.style.color = state.isCalibrated ? '#51cf66' : '#ffd43b';
      }
    }

    // 디버그 데이터를 저장하고 프레임 이미지 표시
    if (debugVideo) {
      debugVideo.lastDebugData = data;
    }

    if (data.frameImage) {
      displayDebugFrame(data.frameImage);
    }

    // 캔버스에 시선 방향 및 얼굴/눈 영역 표시
    if (data.gazeX !== undefined && data.gazeY !== undefined) {
      const eyeRegions = data.eyeTracking && data.eyeTracking.regions ? data.eyeTracking.regions : null;
      drawGazeIndicator(data.gazeX, data.gazeY, eyeRegions, data.currentFaceRegion);
    }
  }

  function displayDebugFrame(imageData) {
    // Content Script의 이미지를 background로 사용 (항상 표시)
    if (debugVideo && imageData) {
      debugVideo.style.backgroundImage = `url(${imageData})`;
      debugVideo.style.backgroundSize = 'cover';
      debugVideo.style.backgroundPosition = 'center';
      debugVideo.style.backgroundRepeat = 'no-repeat';
      debugVideo.style.opacity = '1';
      const loadingElement = document.getElementById('cameraLoading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    } else if (debugVideo) {
      // 이미지가 없으면 background-image 제거
      debugVideo.style.backgroundImage = 'none';
      debugVideo.style.opacity = '1';
    }

    // 얼굴 오버레이를 canvas에 그림 (항상 표시)
    if (debugVideo.lastDebugData) {
      if (debugVideo.lastDebugData.currentFaceRegion) {
        drawFaceOverlayOnCanvas(debugVideo.lastDebugData);
      } else {
        // 얼굴이 없으면 canvas 클리어
        const ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
      }
    } else {
      // 데이터가 없으면 canvas 클리어
      const ctx = debugCanvas.getContext('2d');
      ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }
  }

  function drawFaceOverlayOnCanvas(debugData) {
    if (!debugData.currentFaceRegion) return;

    const ctx = debugCanvas.getContext('2d');
    ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

    const faceRegion = debugData.currentFaceRegion;
    const scaleX = debugCanvas.width / 640; // 원본 해상도 640x480 기준
    const scaleY = debugCanvas.height / 480;

    // 얼굴 영역 표시
    const faceX = faceRegion.x * scaleX;
    const faceY = faceRegion.y * scaleY;
    const faceWidth = faceRegion.width * scaleX;
    const faceHeight = faceRegion.height * scaleY;

    // 얼굴 윤곽선 (더 두껍고 선명하게)
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(faceX, faceY, faceWidth, faceHeight);

    // 얼굴 영역 채우기 (반투명)
    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
    ctx.fillRect(faceX, faceY, faceWidth, faceHeight);

    // 얼굴 영역 라벨
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`얼굴 (${faceRegion.skinPercentage || '0'}%)`, faceX, faceY - 8);

    // 눈 검색 영역 표시 (얼굴 영역 내)
    const eyeY = faceY + faceHeight * 0.35;
    const eyeHeight = faceHeight * 0.12;
    const leftEyeX = faceX + faceWidth * 0.25;
    const rightEyeX = faceX + faceWidth * 0.6;
    const eyeWidth = faceWidth * 0.15;

    // 왼쪽 눈 검색 영역
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftEyeX, eyeY, eyeWidth, eyeHeight);

    // 오른쪽 눈 검색 영역
    ctx.strokeStyle = 'rgba(0, 128, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightEyeX, eyeY, eyeWidth, eyeHeight);

    // 눈 영역 라벨
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.fillText('눈검색', leftEyeX, eyeY - 3);
    ctx.fillText('눈검색', rightEyeX, eyeY - 3);
  }

  // 확대 기능 관련 함수들 제거됨 - 1배율 고정

  // 캔버스 컨텍스트 캐싱으로 성능 개선
  let debugCtx = null;

  function drawGazeIndicator(gazeX, gazeY, eyeRegions, faceRegion = null) {
    // 컨텍스트 캐싱
    if (!debugCtx) {
      debugCtx = debugCanvas.getContext('2d');
    }

    // 캔버스 클리어 (반투명하게 해서 영상이 보이도록)
    debugCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);

    // 카메라 해상도에서 디버그 캔버스 해상도로 좌표 변환 비율
    const scaleX = debugCanvas.width / 640;
    const scaleY = debugCanvas.height / 480;

    // 얼굴 영역 표시 (얼굴을 찾았을 때)
    if (faceRegion) {
      const faceX = faceRegion.x * scaleX;
      const faceY = faceRegion.y * scaleY;
      const faceWidth = faceRegion.width * scaleX;
      const faceHeight = faceRegion.height * scaleY;

      // 얼굴 영역 윤곽선 (노란색)
      debugCtx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      debugCtx.lineWidth = 3;
      debugCtx.strokeRect(faceX, faceY, faceWidth, faceHeight);

      // 얼굴 영역 배경 (반투명)
      debugCtx.fillStyle = 'rgba(255, 255, 0, 0.1)';
      debugCtx.fillRect(faceX, faceY, faceWidth, faceHeight);

      // 얼굴 영역 라벨 및 정보
      debugCtx.fillStyle = '#ffff00';
      debugCtx.font = 'bold 12px Arial';
      const faceLabel = `얼굴 (${faceRegion.skinPercentage || '0'}%)`;
      debugCtx.fillText(faceLabel, faceX, faceY - 8);

      // 눈을 찾을 것으로 예상되는 영역 표시
      const eyeY = faceY + faceHeight * 0.35;
      const eyeHeight = faceHeight * 0.12;

      // 왼쪽 눈 검색 영역
      const leftEyeX = faceX + faceWidth * 0.25;
      const eyeWidth = faceWidth * 0.15;
      debugCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      debugCtx.lineWidth = 2;
      debugCtx.strokeRect(leftEyeX, eyeY, eyeWidth, eyeHeight);

      // 오른쪽 눈 검색 영역
      const rightEyeX = faceX + faceWidth * 0.6;
      debugCtx.strokeStyle = 'rgba(0, 128, 255, 0.5)';
      debugCtx.lineWidth = 2;
      debugCtx.strokeRect(rightEyeX, eyeY, eyeWidth, eyeHeight);

      // 검색 영역 라벨
      debugCtx.fillStyle = '#ffffff';
      debugCtx.font = '10px Arial';
      debugCtx.fillText('눈검색', leftEyeX, eyeY - 3);
      debugCtx.fillText('눈검색', rightEyeX, eyeY - 3);
    }

    // 눈 영역 표시 (더 크고 명확하게)
    if (eyeRegions && (eyeRegions.leftEye || eyeRegions.rightEye)) {
      // 왼쪽 눈 영역 표시
      if (eyeRegions.leftEye && eyeRegions.leftEye.confidence > 0.05) {
        const leftEye = eyeRegions.leftEye;
        const eyeX = leftEye.x * scaleX;
        const eyeY = leftEye.y * scaleY;
        const eyeWidth = leftEye.width * scaleX;
        const eyeHeight = leftEye.height * scaleY;

        const alpha = Math.max(0.4, leftEye.confidence);

        // 눈 영역 배경 (더 큰 사각형)
        debugCtx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.3})`;
        debugCtx.fillRect(eyeX - 5, eyeY - 5, eyeWidth + 10, eyeHeight + 10);

        // 눈 영역 윤곽선 (더 두껍게)
        debugCtx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
        debugCtx.lineWidth = 4;
        debugCtx.strokeRect(eyeX, eyeY, eyeWidth, eyeHeight);

        // 눈 아이콘 표시 (눈동자 모양)
        const centerX_eye = eyeX + eyeWidth / 2;
        const centerY_eye = eyeY + eyeHeight / 2;
        const eyeRadius = Math.min(eyeWidth, eyeHeight) / 3;

        // 눈동자 (큰 원)
        debugCtx.fillStyle = `rgba(0, 255, 0, ${alpha * 0.8})`;
        debugCtx.beginPath();
        debugCtx.arc(centerX_eye, centerY_eye, eyeRadius, 0, 2 * Math.PI);
        debugCtx.fill();

        // 눈동자 테두리
        debugCtx.strokeStyle = '#ffffff';
        debugCtx.lineWidth = 2;
        debugCtx.stroke();

        // 눈동자 중심점 (작은 검은 점)
        debugCtx.fillStyle = '#000000';
        debugCtx.beginPath();
        debugCtx.arc(centerX_eye, centerY_eye, eyeRadius * 0.4, 0, 2 * Math.PI);
        debugCtx.fill();

        // 눈썹 표시 (눈 위쪽에 호 형태로)
        debugCtx.strokeStyle = '#ffffff';
        debugCtx.lineWidth = 3;
        debugCtx.beginPath();
        debugCtx.moveTo(eyeX - 2, eyeY - 8);
        debugCtx.quadraticCurveTo(eyeX + eyeWidth / 2, eyeY - 12, eyeX + eyeWidth + 2, eyeY - 8);
        debugCtx.stroke();

        // 신뢰도 표시 (더 큰 글씨로)
        debugCtx.fillStyle = '#ffffff';
        debugCtx.font = 'bold 12px Arial';
        debugCtx.fillText(`왼쪽눈 ${(leftEye.confidence * 100).toFixed(0)}%`, eyeX, eyeY - 15);
      }

      // 오른쪽 눈 영역 표시
      if (eyeRegions.rightEye && eyeRegions.rightEye.confidence > 0.05) {
        const rightEye = eyeRegions.rightEye;
        const eyeX = rightEye.x * scaleX;
        const eyeY = rightEye.y * scaleY;
        const eyeWidth = rightEye.width * scaleX;
        const eyeHeight = rightEye.height * scaleY;

        const alpha = Math.max(0.4, rightEye.confidence);

        // 눈 영역 배경 (더 큰 사각형)
        debugCtx.fillStyle = `rgba(0, 128, 255, ${alpha * 0.3})`;
        debugCtx.fillRect(eyeX - 5, eyeY - 5, eyeWidth + 10, eyeHeight + 10);

        // 눈 영역 윤곽선 (더 두껍게)
        debugCtx.strokeStyle = `rgba(0, 128, 255, ${alpha})`;
        debugCtx.lineWidth = 4;
        debugCtx.strokeRect(eyeX, eyeY, eyeWidth, eyeHeight);

        // 눈 아이콘 표시 (눈동자 모양)
        const centerX_eye = eyeX + eyeWidth / 2;
        const centerY_eye = eyeY + eyeHeight / 2;
        const eyeRadius = Math.min(eyeWidth, eyeHeight) / 3;

        // 눈동자 (큰 원)
        debugCtx.fillStyle = `rgba(0, 128, 255, ${alpha * 0.8})`;
        debugCtx.beginPath();
        debugCtx.arc(centerX_eye, centerY_eye, eyeRadius, 0, 2 * Math.PI);
        debugCtx.fill();

        // 눈동자 테두리
        debugCtx.strokeStyle = '#ffffff';
        debugCtx.lineWidth = 2;
        debugCtx.stroke();

        // 눈동자 중심점 (작은 검은 점)
        debugCtx.fillStyle = '#000000';
        debugCtx.beginPath();
        debugCtx.arc(centerX_eye, centerY_eye, eyeRadius * 0.4, 0, 2 * Math.PI);
        debugCtx.fill();

        // 눈썹 표시 (눈 위쪽에 호 형태로)
        debugCtx.strokeStyle = '#ffffff';
        debugCtx.lineWidth = 3;
        debugCtx.beginPath();
        debugCtx.moveTo(eyeX - 2, eyeY - 8);
        debugCtx.quadraticCurveTo(eyeX + eyeWidth / 2, eyeY - 12, eyeX + eyeWidth + 2, eyeY - 8);
        debugCtx.stroke();

        // 신뢰도 표시 (더 큰 글씨로)
        debugCtx.fillStyle = '#ffffff';
        debugCtx.font = 'bold 12px Arial';
        debugCtx.fillText(`오른쪽눈 ${(rightEye.confidence * 100).toFixed(0)}%`, eyeX, eyeY - 15);
      }

      // 두 눈 사이에 선 연결 (눈 추적 상태 시각화)
      if (eyeRegions.leftEye && eyeRegions.rightEye &&
          eyeRegions.leftEye.confidence > 0.05 && eyeRegions.rightEye.confidence > 0.05) {

        const leftCenterX = (eyeRegions.leftEye.x + eyeRegions.leftEye.width / 2) * scaleX;
        const leftCenterY = (eyeRegions.leftEye.y + eyeRegions.leftEye.height / 2) * scaleY;
        const rightCenterX = (eyeRegions.rightEye.x + eyeRegions.rightEye.width / 2) * scaleX;
        const rightCenterY = (eyeRegions.rightEye.y + eyeRegions.rightEye.height / 2) * scaleY;

        // 눈 사이 거리 표시
        const distance = Math.sqrt(Math.pow(rightCenterX - leftCenterX, 2) + Math.pow(rightCenterY - leftCenterY, 2));
        debugCtx.fillStyle = '#ffff00';
        debugCtx.font = '10px Arial';
        debugCtx.fillText(`${distance.toFixed(0)}px`, (leftCenterX + rightCenterX) / 2, (leftCenterY + rightCenterY) / 2 - 10);

        // 눈 사이 연결선 (더 두껍게)
        debugCtx.strokeStyle = '#ffff00';
        debugCtx.lineWidth = 3;
        debugCtx.setLineDash([5, 5]);
        debugCtx.beginPath();
        debugCtx.moveTo(leftCenterX, leftCenterY);
        debugCtx.lineTo(rightCenterX, rightCenterY);
        debugCtx.stroke();
        debugCtx.setLineDash([]);
      }
    } else {
      // 눈을 찾지 못했을 때 메시지 표시
      debugCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      debugCtx.font = 'bold 16px Arial';
      debugCtx.textAlign = 'center';
      debugCtx.fillText('👁️ 눈을 찾는 중...', debugCanvas.width / 2, debugCanvas.height / 2);
      debugCtx.fillText('얼굴을 정면으로 향해주세요', debugCanvas.width / 2, debugCanvas.height / 2 + 25);
      debugCtx.textAlign = 'left';
    }

    // 시선 방향 표시 (눈 추적이 활성화되었을 때만)
    if (gazeX !== undefined && gazeY !== undefined && eyeRegions &&
        ((eyeRegions.leftEye && eyeRegions.leftEye.confidence > 0.05) ||
         (eyeRegions.rightEye && eyeRegions.rightEye.confidence > 0.05))) {

      const gazeScreenX = gazeX * debugCanvas.width;
      const gazeScreenY = gazeY * debugCanvas.height;

      // 시선 방향 십자가 (크고 명확하게)
      debugCtx.strokeStyle = '#ff4444';
      debugCtx.lineWidth = 4;
      debugCtx.beginPath();
      debugCtx.moveTo(gazeScreenX - 20, gazeScreenY);
      debugCtx.lineTo(gazeScreenX + 20, gazeScreenY);
      debugCtx.moveTo(gazeScreenX, gazeScreenY - 20);
      debugCtx.lineTo(gazeScreenX, gazeScreenY + 20);
      debugCtx.stroke();

      // 시선 방향 원형 표시
      debugCtx.strokeStyle = '#ff4444';
      debugCtx.lineWidth = 2;
      debugCtx.beginPath();
      debugCtx.arc(gazeScreenX, gazeScreenY, 15, 0, 2 * Math.PI);
      debugCtx.stroke();

      // 시선 방향 텍스트
      debugCtx.fillStyle = '#ff4444';
      debugCtx.font = 'bold 12px Arial';
      debugCtx.textAlign = 'center';
      debugCtx.fillText('👁️', gazeScreenX, gazeScreenY - 25);
      debugCtx.textAlign = 'left';
    }

    // 디버그 정보 표시 (좌상단)
    debugCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    debugCtx.fillRect(5, 5, 250, 80);

    debugCtx.fillStyle = '#ffffff';
    debugCtx.font = '10px monospace';
    debugCtx.fillText(`해상도: 640x480 (1배율)`, 10, 20);

    const eyeStatus = eyeRegions && (eyeRegions.leftEye || eyeRegions.rightEye) ? '활성' : '비활성';
    const eyeStatusColor = eyeStatus === '활성' ? '#00ff00' : '#ff6b6b';
    debugCtx.fillStyle = eyeStatusColor;
    debugCtx.fillText(`눈 추적: ${eyeStatus}`, 10, 35);

    debugCtx.fillStyle = '#ffffff';
    debugCtx.fillText(`시선: ${gazeX !== undefined ? `X:${(gazeX * 100).toFixed(1)}% Y:${(gazeY * 100).toFixed(1)}%` : '없음'}`, 10, 50);

    // 얼굴 감지 정보 추가
    if (faceRegion) {
      const faceInfo = `얼굴: ${faceRegion.skinPercentage || '0'}% (${faceRegion.skinPixels || 0}/${faceRegion.totalSamples || 0})`;
      debugCtx.fillStyle = '#ffff00';
      debugCtx.fillText(faceInfo, 10, 65);
    } else {
      debugCtx.fillStyle = '#ff6b6b';
      debugCtx.fillText('얼굴: 감지되지 않음', 10, 65);
    }
  }

  function showError(message) {
    // 간단한 에러 표시
    statusText.textContent = message;
    statusDot.classList.remove('active');
    setTimeout(() => {
      statusText.textContent = isActive ? '활성화됨' : '비활성화됨';
      if (isActive) statusDot.classList.add('active');
    }, 3000);
  }

  // 초기 상태 확인
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getStatus'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('초기 상태 확인 메시지 전송 오류:', chrome.runtime.lastError);
        return;
      }

      if (response && response.isActive) {
        isActive = true;
        updateUI(true);
      }
    });
  });
});
