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
  const cameraResolution = document.getElementById('cameraResolution');
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
  const pipModeBtn = document.getElementById('pipModeBtn');
  const eyeTrackingStatus = document.getElementById('eyeTrackingStatus');
  const calibrationProgress = document.getElementById('calibrationProgress');
  const debugPanelContainer = document.getElementById('debugPanelContainer');

  // 새로운 디버그 요소들
  const faceDetectionStatus = document.getElementById('faceDetectionStatus');
  const detectionMethod = document.getElementById('detectionMethod');
  const mediaPipeStatus = document.getElementById('mediaPipeStatus');
  const eyeTrackingQuality = document.getElementById('eyeTrackingQuality');
  const topBrightness = document.getElementById('topBrightness');
  const bottomBrightness = document.getElementById('bottomBrightness');
  const eyeDistance = document.getElementById('eyeDistance');
  const leftEyeConfidence = document.getElementById('leftEyeConfidence');
  const rightEyeConfidence = document.getElementById('rightEyeConfidence');
  const skinPixels = document.getElementById('skinPixels');
  const headTilt = document.getElementById('headTilt');

  let isActive = false;
  let pipWindow = null;
  let pipCanvas = null;
  let pipCtx = null;
  let isPipMode = false;

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

  // 카메라 해상도 변경 이벤트 (즉시 적용)
  cameraResolution.addEventListener('change', function() {
    saveSettings();
    
    // 활성화된 상태라면 즉시 해상도 변경
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setCameraResolution',
        resolution: cameraResolution.value
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('해상도 변경 실패:', chrome.runtime.lastError);
        } else {
          console.log('✅ 카메라 해상도 변경됨:', cameraResolution.value);
        }
      });
    });
  });

  // debugMode 이벤트 리스너 제거됨 - 항상 디버그 모드로 작동

  // 줌 기능 제거됨

  // 좌우 반전 모드 이벤트 제거됨 - 항상 반전 모드로 고정

  // 눈 중앙 맞추기 버튼 이벤트
  recenterEyes.addEventListener('click', function() {
    recenterEyeTracking();
  });

  // PIP 모드 버튼 이벤트
  pipModeBtn.addEventListener('click', function() {
    togglePipMode();
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
      bottomZone: parseInt(bottomZone.value),
      cameraResolution: cameraResolution.value
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
        cameraResolution.value = settings.cameraResolution || 'HD';
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

    // MediaPipe 상태 업데이트
    if (data.systemStatus && data.systemStatus.mediaPipeStatus) {
      const mpStatus = data.systemStatus.mediaPipeStatus;
      
      if (detectionMethod) {
        detectionMethod.textContent = data.systemStatus.faceDetectionMethod || '기본';
        detectionMethod.style.color = data.systemStatus.faceDetectionMethod === 'MediaPipe Face Mesh' ? '#51cf66' : '#ffd43b';
      }
      
      if (mediaPipeStatus) {
        if (mpStatus.initialized) {
          if (mpStatus.hasResults) {
            mediaPipeStatus.textContent = `활성 (${mpStatus.landmarkCount}개)`;
            mediaPipeStatus.style.color = '#51cf66';
          } else {
            mediaPipeStatus.textContent = '초기화됨';
            mediaPipeStatus.style.color = '#ffd43b';
          }
        } else {
          mediaPipeStatus.textContent = '로딩중';
          mediaPipeStatus.style.color = '#ff6b6b';
        }
      }
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

    // 머리 기울기 정보 업데이트
    if (data.headTiltInfo && headTilt) {
      const tiltInfo = data.headTiltInfo;
      if (tiltInfo.isValid) {
        const pitchDegrees = (tiltInfo.pitch * 45).toFixed(1); // -45° ~ +45° 범위로 변환
        headTilt.textContent = `${pitchDegrees}°`;
        
        // 색상으로 기울기 정도 표시
        const absAngle = Math.abs(parseFloat(pitchDegrees));
        if (absAngle < 5) {
          headTilt.style.color = '#51cf66'; // 녹색: 정면
        } else if (absAngle < 15) {
          headTilt.style.color = '#ffd43b'; // 노란색: 약간 기울임
        } else {
          headTilt.style.color = '#ff6b6b'; // 빨간색: 많이 기울임
        }
      } else {
        headTilt.textContent = '감지불가';
        headTilt.style.color = '#868e96';
      }
    } else if (headTilt) {
      headTilt.textContent = '0.0°';
      headTilt.style.color = '#868e96';
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

    // 전역에서 접근 가능하도록 현재 디버그 데이터 저장
    window.currentDebugData = data;

    // MediaPipe 디버깅 정보 출력
    if (data.mediaPipeDebug) {
      console.log('🔍 MediaPipe 디버그:', {
        초기화됨: data.mediaPipeDebug.initialized,
        결과있음: data.mediaPipeDebug.hasResults,
        랜드마크있음: data.mediaPipeDebug.hasLandmarks,
        랜드마크수: data.mediaPipeDebug.landmarkCount,
        실제랜드마크데이터: !!data.mediaPipeLandmarks
      });
    }

    if (data.frameImage) {
      displayDebugFrame(data.frameImage);
    }

    // 캔버스에 시선 방향 및 얼굴/눈 영역 표시
    if (data.gazeX !== undefined && data.gazeY !== undefined) {
      const eyeRegions = data.eyeTracking && data.eyeTracking.regions ? data.eyeTracking.regions : null;
      drawGazeIndicator(data.gazeX, data.gazeY, eyeRegions, data.currentFaceRegion);
    }

    // PIP 창 업데이트
    if (isPipMode) {
      updatePipWindow(data);
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

  // PIP 모드 토글 함수
  function togglePipMode() {
    if (!isPipMode) {
      openPipWindow();
    } else {
      closePipWindow();
    }
  }

  // PIP 창 열기
  function openPipWindow() {
    try {
      // PIP 창 크기 및 위치 계산
      const pipWidth = 400;
      const pipHeight = 350;
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      const pipX = screenWidth - pipWidth - 20; // 오른쪽 상단
      const pipY = 20;

      // 새 창 열기
      pipWindow = window.open('', 'GazeScrollPIP', 
        `width=${pipWidth},height=${pipHeight},left=${pipX},top=${pipY},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`);

      if (!pipWindow) {
        alert('팝업 차단기가 활성화되어 있습니다. PIP 모드를 사용하려면 팝업을 허용해주세요.');
        return;
      }

      // PIP 창 HTML 구성
      pipWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>👁️ Gaze Scroll - PIP 모드</title>
          <style>
            body {
              margin: 0;
              padding: 10px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: white;
              overflow: hidden;
            }
            .pip-header {
              text-align: center;
              margin-bottom: 10px;
              font-size: 14px;
              font-weight: bold;
            }
            .pip-canvas-container {
              position: relative;
              width: 100%;
              height: 240px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            #pipCanvas {
              max-width: 100%;
              max-height: 100%;
              border-radius: 8px;
            }
            .pip-status {
              margin-top: 10px;
              font-size: 11px;
              text-align: center;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .status-item {
              background: rgba(255, 255, 255, 0.1);
              padding: 5px;
              border-radius: 4px;
            }
            .close-btn {
              position: absolute;
              top: 5px;
              right: 5px;
              background: rgba(255, 255, 255, 0.2);
              border: none;
              color: white;
              padding: 5px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .close-btn:hover {
              background: rgba(255, 255, 255, 0.3);
            }
          </style>
        </head>
        <body>
          <button class="close-btn" onclick="window.close()">✕</button>
          <div class="pip-header">👁️ 시선 추적 모니터</div>
          <div class="pip-canvas-container">
            <canvas id="pipCanvas" width="320" height="240"></canvas>
          </div>
          <div class="pip-status">
            <div class="status-item">
              <div>상태: <span id="pipTrackingStatus">대기중</span></div>
            </div>
            <div class="status-item">
              <div>방식: <span id="pipDetectionMethod">기본</span></div>
            </div>
            <div class="status-item">
              <div>시선: <span id="pipGazePosition">중앙</span></div>
            </div>
            <div class="status-item">
              <div>스크롤: <span id="pipScrollDirection">정지</span></div>
            </div>
          </div>
        </body>
        </html>
      `);

      pipWindow.document.close();

      // PIP 캔버스 설정
      pipCanvas = pipWindow.document.getElementById('pipCanvas');
      pipCtx = pipCanvas.getContext('2d');

      // PIP 창 닫힘 이벤트 처리
      pipWindow.addEventListener('beforeunload', function() {
        closePipWindow();
      });

      isPipMode = true;
      pipModeBtn.textContent = '📺 PIP 종료';
      pipModeBtn.style.background = '#e17055';

      console.log('✅ PIP 모드 활성화됨');
      showTopNotification('📺 PIP 모드가 활성화되었습니다! 독립 창에서 시선 추적을 모니터링하세요.', 3000);

    } catch (error) {
      console.error('PIP 창 생성 실패:', error);
      showTopNotification('❌ PIP 모드 활성화에 실패했습니다.', 2000);
    }
  }

  // PIP 창 닫기
  function closePipWindow() {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
    
    pipWindow = null;
    pipCanvas = null;
    pipCtx = null;
    isPipMode = false;
    
    pipModeBtn.textContent = '📺 PIP 모드';
    pipModeBtn.style.background = '#fd79a8';
    
    console.log('✅ PIP 모드 비활성화됨');
  }

  // PIP 창 업데이트
  function updatePipWindow(data) {
    if (!isPipMode || !pipWindow || pipWindow.closed || !pipCtx) {
      return;
    }

    try {
      // 캔버스 클리어
      pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);

      // 현재 프레임 이미지가 있으면 그리기
      if (data.frameImage) {
        const img = new Image();
        img.onload = function() {
          pipCtx.drawImage(img, 0, 0, pipCanvas.width, pipCanvas.height);
          
          // MediaPipe 랜드마크 그리기
          if (data.mediaPipeLandmarks) {
            drawPipLandmarks(pipCtx, data.mediaPipeLandmarks);
          }
          
          // 시선 방향 표시
          if (data.gazeX !== undefined && data.gazeY !== undefined) {
            drawPipGazeIndicator(pipCtx, data.gazeX, data.gazeY);
          }
        };
        img.src = data.frameImage;
      }

      // 상태 정보 업데이트
      const pipTrackingStatus = pipWindow.document.getElementById('pipTrackingStatus');
      const pipDetectionMethod = pipWindow.document.getElementById('pipDetectionMethod');
      const pipGazePosition = pipWindow.document.getElementById('pipGazePosition');
      const pipScrollDirection = pipWindow.document.getElementById('pipScrollDirection');

      if (pipTrackingStatus) {
        pipTrackingStatus.textContent = data.systemStatus && data.systemStatus.isActive ? '활성' : '비활성';
        pipTrackingStatus.style.color = data.systemStatus && data.systemStatus.isActive ? '#00d4aa' : '#fab1a0';
      }

      if (pipDetectionMethod) {
        const method = data.systemStatus && data.systemStatus.faceDetectionMethod === 'MediaPipe Face Mesh' ? 'AI' : '기본';
        pipDetectionMethod.textContent = method;
        pipDetectionMethod.style.color = method === 'AI' ? '#00d4aa' : '#fdcb6e';
      }

      if (pipGazePosition) {
        pipGazePosition.textContent = data.gazePosition || '중앙';
      }

      if (pipScrollDirection) {
        const direction = data.scrollDirection === -1 ? '위로' : data.scrollDirection === 1 ? '아래로' : '정지';
        pipScrollDirection.textContent = direction;
        pipScrollDirection.style.color = direction === '정지' ? '#b2bec3' : '#00d4aa';
      }

    } catch (error) {
      console.warn('PIP 창 업데이트 중 오류:', error);
    }
  }

  // PIP 창에서 랜드마크 그리기
  function drawPipLandmarks(ctx, landmarks) {
    if (!landmarks || landmarks.length === 0) return;

    // 주요 특징점만 표시 (성능 최적화)
    const eyeLandmarks = [
      // 왼쪽 눈
      33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
      // 오른쪽 눈  
      362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382
    ];

    // 눈 영역 표시
    ctx.strokeStyle = '#00d4aa';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 212, 170, 0.3)';

    eyeLandmarks.forEach(index => {
      if (landmarks[index]) {
        const x = landmarks[index].x * pipCanvas.width;
        const y = landmarks[index].y * pipCanvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  // PIP 창에서 시선 방향 표시
  function drawPipGazeIndicator(ctx, gazeX, gazeY) {
    const x = gazeX * pipCanvas.width;
    const y = gazeY * pipCanvas.height;

    // 시선 십자가
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x + 15, y);
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y + 15);
    ctx.stroke();

    // 시선 원
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // MediaPipe 얼굴 랜드마크 그리기 함수
  function drawEnhancedFaceDetection(ctx) {
    if (!window.currentDebugData) {
      return;
    }

    const data = window.currentDebugData;
    
    // MediaPipe 데이터가 있으면 고급 표시
    if (data.mediaPipeLandmarks && data.mediaPipeLandmarks.length > 0) {
      drawAdvancedMediaPipeFace(ctx, data);
    } 
    // 기본 얼굴 감지 결과 표시
    else if (data.currentFaceRegion) {
      drawBasicFaceDetection(ctx, data);
    }
    // 얼굴을 찾지 못했을 때
    else {
      drawNoFaceDetected(ctx);
    }
  }

  function drawAdvancedMediaPipeFace(ctx, data) {
    const landmarks = data.mediaPipeLandmarks;

    // 화면 클리어 (반투명)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);

    // 얼굴 윤곽선 그리기
    drawFaceOutline(ctx, landmarks);
    
    // 눈 영역 강조 표시
    drawEyeRegions(ctx, landmarks);
    
    // 코와 입 표시
    drawFacialFeatures(ctx, landmarks);
    
    // 얼굴 중심점과 정보 표시
    drawFaceInfo(ctx, data);
  }

  function drawFaceOutline(ctx, landmarks) {
    // 얼굴 윤곽선 주요 포인트들
    const faceOval = [10, 151, 234, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150];
    
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)'; // 골드 색상
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i < faceOval.length; i++) {
      const point = landmarks[faceOval[i]];
      const x = point.x * debugCanvas.width;
      const y = point.y * debugCanvas.height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    
    // 얼굴 윤곽선 내부 반투명 채우기
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fill();
  }

  function drawEyeRegions(ctx, landmarks) {
    // 왼쪽 눈 (빨간색)
    const leftEyePoints = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
    drawEyeRegion(ctx, landmarks, leftEyePoints, 'rgba(255, 50, 50, 0.9)', '왼쪽 눈');
    
    // 오른쪽 눈 (파란색)
    const rightEyePoints = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    drawEyeRegion(ctx, landmarks, rightEyePoints, 'rgba(50, 150, 255, 0.9)', '오른쪽 눈');
  }

  function drawEyeRegion(ctx, landmarks, eyePoints, color, label) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
        ctx.beginPath();
    
    for (let i = 0; i < eyePoints.length; i++) {
      const point = landmarks[eyePoints[i]];
      const x = point.x * debugCanvas.width;
      const y = point.y * debugCanvas.height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    
    // 눈 영역 채우기
    ctx.fillStyle = color.replace('0.9', '0.2');
    ctx.fill();
    
    // 눈 중심점 계산 및 표시
    let centerX = 0, centerY = 0;
    for (const index of eyePoints) {
      centerX += landmarks[index].x;
      centerY += landmarks[index].y;
    }
    centerX = (centerX / eyePoints.length) * debugCanvas.width;
    centerY = (centerY / eyePoints.length) * debugCanvas.height;
    
    // 눈 중심에 큰 점 표시
    ctx.fillStyle = color;
          ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
          ctx.fill();
          
    // 눈 중심에 흰색 테두리
          ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
          ctx.stroke();
          
    // 눈 라벨
            ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(label, centerX - 20, centerY - 15);
  }

  function drawFacialFeatures(ctx, landmarks) {
    // 코 (주황색)
    const nosePoints = [1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236];
    drawFeaturePoints(ctx, landmarks, nosePoints, 'rgba(255, 165, 0, 0.8)', 4);
    
    // 입 (마젠타)
    const mouthPoints = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
    drawFeaturePoints(ctx, landmarks, mouthPoints, 'rgba(255, 20, 147, 0.8)', 3);
  }

  function drawFeaturePoints(ctx, landmarks, points, color, size) {
            ctx.fillStyle = color;
    for (const index of points) {
      const point = landmarks[index];
      const x = point.x * debugCanvas.width;
      const y = point.y * debugCanvas.height;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function drawFaceInfo(ctx, data) {
    // 정보 패널 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(5, 5, 300, 120);
    
    // 제목
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🧠 MediaPipe Face Mesh 감지됨', 10, 25);
    
    // 상세 정보
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    let y = 45;
    
    // 랜드마크 수
    ctx.fillText(`랜드마크: ${data.mediaPipeLandmarks.length}개`, 10, y);
    y += 15;
    
    // 얼굴 신뢰도 (있다면)
    if (data.systemStatus && data.systemStatus.mediaPipeStatus) {
      const mpStatus = data.systemStatus.mediaPipeStatus;
      ctx.fillStyle = mpStatus.hasResults ? '#00ff88' : '#ffaa00';
      ctx.fillText(`상태: ${mpStatus.hasResults ? '활성' : '대기중'}`, 10, y);
      y += 15;
    }
    
    // 머리 자세 정보 (있다면)
    if (data.headTiltInfo && data.headTiltInfo.isValid) {
      const tilt = data.headTiltInfo;
      ctx.fillStyle = '#87ceeb';
      ctx.fillText(`머리 자세: ${(tilt.pitch * 45).toFixed(1)}° (상하)`, 10, y);
      y += 15;
      ctx.fillText(`          ${(tilt.yaw * 45).toFixed(1)}° (좌우)`, 10, y);
      y += 15;
    }
    
    // 품질 점수 (있다면)
    if (data.eyeTracking && data.eyeTracking.quality) {
      const quality = data.eyeTracking.quality;
      ctx.fillStyle = quality.status === 'good' ? '#00ff88' : 
                     quality.status === 'fair' ? '#ffaa00' : '#ff6666';
      ctx.fillText(`추적 품질: ${(quality.score * 100).toFixed(0)}% (${quality.status})`, 10, y);
    }
  }

  function drawBasicFaceDetection(ctx, data) {
    const faceRegion = data.currentFaceRegion;
    
    // 화면 클리어 (반투명)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
    
    // 얼굴 영역 표시
    const scaleX = debugCanvas.width / 640;
    const scaleY = debugCanvas.height / 480;

      const faceX = faceRegion.x * scaleX;
      const faceY = faceRegion.y * scaleY;
      const faceWidth = faceRegion.width * scaleX;
      const faceHeight = faceRegion.height * scaleY;

    // 얼굴 영역 윤곽선
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.lineWidth = 4;
    ctx.strokeRect(faceX, faceY, faceWidth, faceHeight);
    
    // 얼굴 영역 채우기
    ctx.fillStyle = 'rgba(255, 255, 0, 0.15)';
    ctx.fillRect(faceX, faceY, faceWidth, faceHeight);
    
    // 얼굴 중심점
    const centerX = faceX + faceWidth / 2;
    const centerY = faceY + faceHeight / 2;
    
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 정보 표시
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(5, 5, 250, 80);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('📷 기본 얼굴 감지', 10, 25);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.fillText(`피부톤: ${faceRegion.skinPercentage || '0'}%`, 10, 45);
    ctx.fillText(`픽셀: ${faceRegion.skinPixels || 0}/${faceRegion.totalSamples || 0}`, 10, 60);
    ctx.fillText(`위치: ${faceX.toFixed(0)}, ${faceY.toFixed(0)}`, 10, 75);
  }

  function drawNoFaceDetected(ctx) {
    // 화면 클리어
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
    
    // 메시지 표시
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👤 얼굴을 찾는 중...', debugCanvas.width / 2, debugCanvas.height / 2 - 20);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px Arial';
    ctx.fillText('카메라를 정면으로 향해주세요', debugCanvas.width / 2, debugCanvas.height / 2 + 10);
    ctx.fillText('충분한 조명이 있는지 확인해주세요', debugCanvas.width / 2, debugCanvas.height / 2 + 30);
    
    ctx.textAlign = 'left';
    
    // 로딩 애니메이션 (간단한 점들)
    const time = Date.now() / 500;
    for (let i = 0; i < 3; i++) {
      const alpha = (Math.sin(time + i * 0.5) + 1) / 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(debugCanvas.width / 2 - 20 + i * 20, debugCanvas.height / 2 + 60, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function drawMediaPipeLandmarks(ctx) {
    // 기존 함수는 새로운 enhanced 버전으로 대체됨
    drawEnhancedFaceDetection(ctx);
  }

  function drawGazeIndicator(gazeX, gazeY, eyeRegions, faceRegion = null) {
    // 컨텍스트 캐싱
    if (!debugCtx) {
      debugCtx = debugCanvas.getContext('2d');
    }

    // 향상된 얼굴 감지 표시
    drawEnhancedFaceDetection(debugCtx);

    // 시선 방향 표시 (얼굴이 감지된 경우에만)
    if (gazeX !== undefined && gazeY !== undefined && 
        (window.currentDebugData && 
         (window.currentDebugData.mediaPipeLandmarks || window.currentDebugData.currentFaceRegion))) {
      drawGazeDirection(debugCtx, gazeX, gazeY);
    }
  }

  function drawGazeDirection(ctx, gazeX, gazeY) {
      const gazeScreenX = gazeX * debugCanvas.width;
      const gazeScreenY = gazeY * debugCanvas.height;

      // 시선 방향 십자가 (크고 명확하게)
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gazeScreenX - 20, gazeScreenY);
    ctx.lineTo(gazeScreenX + 20, gazeScreenY);
    ctx.moveTo(gazeScreenX, gazeScreenY - 20);
    ctx.lineTo(gazeScreenX, gazeScreenY + 20);
    ctx.stroke();

      // 시선 방향 원형 표시
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gazeScreenX, gazeScreenY, 15, 0, 2 * Math.PI);
    ctx.stroke();

    // 내부 원 (더 진한 색)
    ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
    ctx.fill();

      // 시선 방향 텍스트
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👁️', gazeScreenX, gazeScreenY - 25);
    
    // 좌표 표시
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.fillText(`(${(gazeX * 100).toFixed(0)}%, ${(gazeY * 100).toFixed(0)}%)`, gazeScreenX, gazeScreenY + 35);
    ctx.textAlign = 'left';
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

  // 페이지 언로드 시 PIP 창 정리
  window.addEventListener('beforeunload', function() {
    if (isPipMode) {
      closePipWindow();
    }
  });
});
