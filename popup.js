// Gaze Scroll Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const calibrateBtn = document.getElementById('calibrateBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const scrollSpeed = document.getElementById('scrollSpeed');
  const topZone = document.getElementById('topZone');
  const bottomZone = document.getElementById('bottomZone');
  const debugMode = document.getElementById('debugMode');
  const debugPanel = document.getElementById('debugPanel');
  const debugVideo = document.getElementById('debugVideo');
  const debugCanvas = document.getElementById('debugCanvas');
  const gazePosition = document.getElementById('gazePosition');
  const brightnessDiff = document.getElementById('brightnessDiff');
  const scrollDirection = document.getElementById('scrollDirection');
  const acceleration = document.getElementById('acceleration');
  // 줌 기능 제거됨 - 1배율 고정
  const mirrorMode = document.getElementById('mirrorMode');
  const recenterEyes = document.getElementById('recenterEyes');
  const eyeTrackingStatus = document.getElementById('eyeTrackingStatus');
  const calibrationProgress = document.getElementById('calibrationProgress');

  // 새로운 디버그 요소들
  const faceDetectionStatus = document.getElementById('faceDetectionStatus');
  const eyeTrackingQuality = document.getElementById('eyeTrackingQuality');
  const topBrightness = document.getElementById('topBrightness');
  const bottomBrightness = document.getElementById('bottomBrightness');
  const eyeDistance = document.getElementById('eyeDistance');
  const leftEyeConfidence = document.getElementById('leftEyeConfidence');
  const rightEyeConfidence = document.getElementById('rightEyeConfidence');

  let isActive = false;

  // 저장된 설정 불러오기
  loadSettings();

  // 토글 버튼 이벤트
  toggleBtn.addEventListener('click', function() {
    isActive = !isActive;

    if (isActive) {
      startGazeTracking();
    } else {
      stopGazeTracking();
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

  debugMode.addEventListener('change', function() {
    saveSettings();
    toggleDebugMode();
  });

  // 줌 기능 제거됨

  // 좌우 반전 모드 이벤트
  mirrorMode.addEventListener('change', function() {
    saveSettings();
    updateMirrorMode();
  });

  // 눈 중앙 맞추기 버튼 이벤트
  recenterEyes.addEventListener('click', function() {
    recenterEyeTracking();
  });

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
      debugMode: debugMode.checked,
      mirrorMode: mirrorMode.checked
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
        debugMode.checked = settings.debugMode || false;
        mirrorMode.checked = settings.mirrorMode || false;
        // zoomLevel 제거됨 - 1배율 고정

        // 디버그 모드 초기 상태 설정
        if (settings.debugMode) {
          debugPanel.style.display = 'block';
          setupDebugVideo();
        }

        // 좌우 반전 모드 적용
        updateMirrorMode();
      }
    });
  }

  function updateMirrorMode() {
    // content script에 좌우 반전 모드 전달
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setMirrorMode',
        enabled: mirrorMode.checked
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('좌우 반전 모드 설정 오류:', chrome.runtime.lastError);
        }
      });
    });
  }

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

  function toggleDebugMode() {
    const isDebugEnabled = debugMode.checked;

    if (isDebugEnabled) {
      debugPanel.style.display = 'block';
      setupDebugVideo();

      // 디버그 모드 활성화 안내
      showDebugInfo('디버그 모드가 활성화되었습니다. 시선 추적이 시작되면 실시간으로 카메라 화면과 시선 정보를 확인할 수 있습니다.');

      // 메인 시선 추적 상태 확인
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getStatus'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('상태 확인 메시지 전송 오류:', chrome.runtime.lastError);
            showDebugInfo('메시지 전송에 실패했습니다. 페이지를 새로고침한 후 다시 시도해주세요.');
            return;
          }

          if (!response || !response.isActive) {
            showDebugInfo('먼저 "시선 추적 시작" 버튼을 클릭하여 메인 기능을 활성화해주세요. 디버그 모드는 메인 기능과 함께 작동합니다.');
          }
        });
      });
    } else {
      debugPanel.style.display = 'none';
      stopDebugVideo();
    }

    // content script에 디버그 모드 상태 전달
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setDebugMode',
        enabled: isDebugEnabled
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('디버그 모드 설정 메시지 전송 오류:', chrome.runtime.lastError);
        }
      });
    });
  }

  function showDebugInfo(message) {
    const debugContent = document.querySelector('.debug-content');
    if (debugContent) {
      debugContent.innerHTML = `
        <div style="width: 100%; text-align: center; color: #74b9ff; padding: 20px;">
          <div style="font-size: 16px; margin-bottom: 10px;">🔍 디버그 모드 준비</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">${message}</div>
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 10px;">
            ※ 시선 추적을 시작하면 실시간 디버그 정보가 표시됩니다
          </div>
        </div>
      `;
    }
  }

  function setupDebugVideo() {
    // 디버그 캔버스 설정
    const ctx = debugCanvas.getContext('2d');
    debugCanvas.width = 320;
    debugCanvas.height = 240;

    // 디버그 정보 업데이트 리스너 등록
    chrome.runtime.onMessage.addListener(function(message) {
      if (message.action === 'debugUpdate') {
        updateDebugInfo(message.data);
      }
    });

    console.log('디버그 모드 초기화 완료');
  }

  function showDebugError(message) {
    // 디버그 패널에 오류 메시지 표시
    const debugContent = document.querySelector('.debug-content');
    if (debugContent) {
      debugContent.innerHTML = `
        <div style="width: 100%; text-align: center; color: #ff6b6b; padding: 20px;">
          <div style="font-size: 16px; margin-bottom: 10px;">⚠️ 디버그 모드 오류</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">${message}</div>
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 10px;">
            ※ 메인 시선 추적 기능은 정상 작동합니다
          </div>
        </div>
      `;
    }
  }

  function stopDebugVideo() {
    if (debugVideo.srcObject) {
      debugVideo.srcObject.getTracks().forEach(track => track.stop());
      debugVideo.srcObject = null;
    }
    // 디버그 비디오 배경 초기화
    debugVideo.style.backgroundImage = 'none';
  }

  function updateDebugInfo(data) {
    // 기존 요소들 업데이트
    if (data.gazePosition !== undefined) {
      gazePosition.textContent = data.gazePosition;
    }
    if (data.brightnessDiff !== undefined) {
      brightnessDiff.textContent = data.brightnessDiff.toFixed(3);
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

    // 디버그 비디오에 프레임 이미지 표시
    if (data.frameImage) {
      displayDebugFrame(data.frameImage);
    }

    // 캔버스에 시선 방향 표시
    if (data.gazeX !== undefined && data.gazeY !== undefined) {
      drawGazeIndicator(data.gazeX, data.gazeY, data.eyeRegions);
    }
  }

  function displayDebugFrame(imageData) {
    // 디버그 모드에서 실시간으로 카메라 영상 표시
    if (debugVideo && imageData) {
      debugVideo.style.backgroundImage = `url(${imageData})`;
      debugVideo.style.backgroundSize = 'cover';
      debugVideo.style.backgroundPosition = 'center';
      debugVideo.style.backgroundRepeat = 'no-repeat';
      debugVideo.style.opacity = '1'; // 항상 표시
    }
  }

  // 확대 기능 관련 함수들 제거됨 - 1배율 고정

  function drawGazeIndicator(gazeX, gazeY, eyeRegions) {
    const ctx = debugCanvas.getContext('2d');
    const centerX = debugCanvas.width / 2;
    const centerY = debugCanvas.height / 2;

    // 캔버스 클리어
    ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

    // 눈 영역 표시 (디버그용)
    if (eyeRegions && eyeRegions.leftEye && eyeRegions.leftEye.confidence > 0) {
      const leftEye = eyeRegions.leftEye;
      // 카메라 해상도에서 디버그 캔버스 해상도로 좌표 변환
      const scaleX = debugCanvas.width / 640;
      const scaleY = debugCanvas.height / 480;

      // 왼쪽 눈 영역 표시
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        leftEye.x * scaleX,
        leftEye.y * scaleY,
        leftEye.width * scaleX,
        leftEye.height * scaleY
      );

      // 왼쪽 눈 텍스트
      ctx.fillStyle = '#00ff00';
      ctx.font = '10px monospace';
      ctx.fillText(
        `L:${leftEye.confidence.toFixed(2)}`,
        leftEye.x * scaleX,
        leftEye.y * scaleY - 5
      );
    }

    if (eyeRegions && eyeRegions.rightEye && eyeRegions.rightEye.confidence > 0) {
      const rightEye = eyeRegions.rightEye;
      const scaleX = debugCanvas.width / 640;
      const scaleY = debugCanvas.height / 480;

      // 오른쪽 눈 영역 표시
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        rightEye.x * scaleX,
        rightEye.y * scaleY,
        rightEye.width * scaleX,
        rightEye.height * scaleY
      );

      // 오른쪽 눈 텍스트
      ctx.fillStyle = '#00ff00';
      ctx.font = '10px monospace';
      ctx.fillText(
        `R:${rightEye.confidence.toFixed(2)}`,
        rightEye.x * scaleX,
        rightEye.y * scaleY - 5
      );
    }

    // 시선 방향 선 그리기
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + (gazeX - 0.5) * 100, centerY + (gazeY - 0.5) * 100);
    ctx.stroke();

    // 시선 위치 점 그리기
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(centerX + (gazeX - 0.5) * 100, centerY + (gazeY - 0.5) * 100, 8, 0, 2 * Math.PI);
    ctx.fill();

    // 중앙 십자선 그리기
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(centerX, centerY + 20);
    ctx.stroke();

    // 시선 방향 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const directionText = gazeY < 0.4 ? '위쪽' : gazeY > 0.6 ? '아래쪽' : '중앙';
    ctx.fillText(directionText, centerX, centerY + 120);
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
});
