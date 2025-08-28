// Gaze Scroll Content Script
class GazeScroll {
  constructor() {
    this.isActive = false;
    this.isCalibrating = false;
    this.tracker = null;
    this.canvas = null;
    this.video = null;
    this.animationId = null;

    this.settings = {
      scrollSpeed: 50,
      topZone: 30,
      bottomZone: 30,
      debugMode: false,
      mirrorMode: false
      // zoomLevel 제거됨 - 1배율 고정
    };

    this.eyeTrackingState = {
      isCalibrated: false,
      lastEyePosition: null,
      calibrationFrames: 0,
      maxCalibrationFrames: 30 // 30프레임 동안 눈 위치를 평균화
    };

    this.lastGazeY = 0;
    this.scrollDirection = 0; // -1: up, 0: stop, 1: down
    this.scrollAcceleration = 0;

    this.init();
  }

  init() {
    // 메시지 리스너 설정
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // 초기 설정 적용
    this.applyMirrorMode();
  }

  setMirrorMode(enabled) {
    this.settings.mirrorMode = enabled;
    this.applyMirrorMode();
  }

  applyMirrorMode() {
    if (this.video) {
      if (this.settings.mirrorMode) {
        this.video.style.transform = 'scaleX(-1)';
      } else {
        this.video.style.transform = 'scaleX(1)';
      }
    }
  }

  recenterEyes() {
    // 눈 중앙 맞추기 초기화
    this.eyeTrackingState.isCalibrated = false;
    this.eyeTrackingState.calibrationFrames = 0;
    this.eyeTrackingState.lastEyePosition = null;

    this.showNotification('눈 위치를 다시 찾고 있습니다. 잠시만 기다려주세요...', 'info');

    // 3초 후에 캘리브레이션 완료 알림
    setTimeout(() => {
      if (this.eyeTrackingState.isCalibrated) {
        this.showNotification('눈 중앙 맞추기가 완료되었습니다!', 'success');
      } else {
        this.showNotification('눈을 찾지 못했습니다. 밝은 곳에서 다시 시도해주세요.', 'warning');
      }
    }, 3000);
  }

  // MediaDevices API를 사용하여 간단한 얼굴 감지 초기화
  initCameraElements() {
    // 비디오 요소 생성
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.autoplay = true;
    this.video.playsInline = true;

    // 캔버스 요소 생성
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'none';
    this.canvas.width = 640;
    this.canvas.height = 480;

    document.body.appendChild(this.video);
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'startGazeTracking':
        this.settings = message.settings;
        this.startGazeTracking()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'stopGazeTracking':
        this.stopGazeTracking();
        sendResponse({ success: true });
        break;

      case 'calibrate':
        this.calibrate();
        sendResponse({ success: true });
        break;

      case 'getStatus':
        sendResponse({ isActive: this.isActive });
        break;

      case 'setDebugMode':
        this.settings.debugMode = message.enabled;
        sendResponse({ success: true });
        break;

      case 'setMirrorMode':
        this.setMirrorMode(message.enabled);
        sendResponse({ success: true });
        break;

      case 'recenterEyes':
        this.recenterEyes();
        sendResponse({ success: true });
        break;

      case 'tabUpdated':
        // 탭이 업데이트되면 필요한 초기화 작업
        break;
    }
    return true;
  }

  async startGazeTracking() {
    if (this.isActive) return Promise.resolve();

    try {
      // 카메라 권한 확인 및 요청
      await this.requestCameraPermission();

      // 카메라 요소 초기화
      this.initCameraElements();

      // 카메라 스트림 시작
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        }
      });

      this.video.srcObject = stream;
      await this.video.play();

      this.isActive = true;

      // 시선 추적 루프 시작
      this.startTrackingLoop();

      console.log('시선 추적이 시작되었습니다.');
      this.showNotification('시선 추적이 시작되었습니다! 이제 눈을 움직여서 스크롤해보세요.', 'success');

      return Promise.resolve();
    } catch (error) {
      console.error('시선 추적 시작 실패:', error);
      this.handleCameraError(error);
      return Promise.reject(error);
    }
  }

  async requestCameraPermission() {
    // 카메라 권한 상태 확인
    if (navigator.permissions) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        console.log('카메라 권한 상태:', permissionStatus.state);

        if (permissionStatus.state === 'denied') {
          throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        }
      } catch (error) {
        console.log('권한 확인 실패:', error);
      }
    }
  }

  handleCameraError(error) {
    let message = '카메라 접근 중 오류가 발생했습니다.';

    switch (error.name) {
      case 'NotAllowedError':
        message = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
        break;
      case 'NotFoundError':
        message = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
        break;
      case 'NotSupportedError':
        message = '이 브라우저에서는 카메라를 지원하지 않습니다.';
        break;
      case 'NotReadableError':
        message = '카메라가 다른 애플리케이션에서 사용 중입니다.';
        break;
      case 'OverconstrainedError':
        message = '요청한 카메라 설정을 지원하지 않습니다.';
        break;
      case 'SecurityError':
        message = '보안 정책으로 인해 카메라에 접근할 수 없습니다.';
        break;
      default:
        if (error.message.includes('permission')) {
          message = '카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.';
        }
        break;
    }

    this.showNotification(message, 'error');
  }

  stopGazeTracking() {
    if (!this.isActive) return;

    this.isActive = false;

    // 카메라 스트림 정리
    if (this.video && this.video.srcObject) {
      const stream = this.video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }

    // 캔버스와 비디오 요소 제거
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.video && this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.scrollDirection = 0;
    this.scrollAcceleration = 0;

    console.log('시선 추적이 중지되었습니다.');
  }

  calibrate() {
    if (!this.isActive || this.isCalibrating) return;

    this.isCalibrating = true;
    this.showNotification('보정 모드에서는 화면 중앙을 바라봐주세요. 3초 후 자동으로 완료됩니다.', 'info');

    setTimeout(() => {
      this.isCalibrating = false;
      this.showNotification('보정이 완료되었습니다!', 'success');
    }, 3000);
  }

  startTrackingLoop() {
    let previousBrightness = 0;
    let frameCount = 0;
    let lastFrameTime = 0;
    const targetFPS = 10; // 10fps로 제한하여 성능 개선
    const frameInterval = 1000 / targetFPS;

    const track = (currentTime = 0) => {
      if (!this.isActive) return;

      // 프레임 레이트 제한
      if (currentTime - lastFrameTime < frameInterval) {
        this.animationId = requestAnimationFrame(track);
        return;
      }
      lastFrameTime = currentTime;

      try {
        // 캔버스에 비디오 프레임 그리기
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

          // 이미지 데이터 가져오기 (최적화: 필요한 영역만 처리)
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const data = imageData.data;

          // 간단한 밝기 분석으로 시선 방향 추정
          const regions = this.analyzeImageRegions(data, this.canvas.width, this.canvas.height);

          // 개선된 눈 영역 감지
          let eyeRegions = null;
          if (this.settings.debugMode || this.eyeTrackingState.isCalibrated) {
            eyeRegions = this.detectEyesWithTracking(data, this.canvas.width, this.canvas.height);
          }

          // 시선 방향 결정 (밝기 변화 기반)
          const currentBrightness = (regions.top + regions.bottom + regions.left + regions.right) / 4;
          const brightnessDiff = currentBrightness - previousBrightness;

          // 화면 높이 기준으로 영역 계산
          const screenHeight = window.innerHeight;
          const topThreshold = screenHeight * (this.settings.topZone / 100);
          const bottomThreshold = screenHeight * (1 - this.settings.bottomZone / 100);

          // 시선 방향 결정 (단순화된 로직)
          // 실제로는 머신러닝 모델이 필요하지만, 여기서는 밝기 변화로 추정
          const gazeY = this.estimateGazeY(regions, screenHeight);

          // 스크롤 방향 결정
          if (gazeY < topThreshold) {
            this.scrollDirection = -1; // 위로 스크롤
            this.scrollAcceleration = Math.max(this.scrollAcceleration + 0.1, 1);
          } else if (gazeY > bottomThreshold) {
            this.scrollDirection = 1; // 아래로 스크롤
            this.scrollAcceleration = Math.max(this.scrollAcceleration + 0.1, 1);
          } else {
            this.scrollDirection = 0;
            this.scrollAcceleration = Math.max(this.scrollAcceleration - 0.2, 0);
          }

          // 스크롤 실행
          if (this.scrollDirection !== 0) {
            this.performScroll();
          }

          // 디버그 모드에서 정보 전송 (최적화: 3프레임에 1번만 전송)
          if ((this.settings.debugMode || this.eyeTrackingState.isCalibrated) && frameCount % 3 === 0) {
            this.sendDebugInfo(regions, currentBrightness, previousBrightness, gazeY, screenHeight, eyeRegions);
          }

          previousBrightness = currentBrightness;
        }

        frameCount++;
      } catch (error) {
        console.error('시선 추적 중 오류:', error);
      }

      this.animationId = requestAnimationFrame(track);
    };

    this.animationId = requestAnimationFrame(track);
  }

  analyzeImageRegions(data, width, height) {
    const regions = {
      top: 0, bottom: 0, left: 0, right: 0,
      center: 0
    };

    const regionHeight = Math.floor(height / 3);
    const regionWidth = Math.floor(width / 3);

    // 각 영역의 평균 밝기 계산
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (y < regionHeight) {
          regions.top += brightness;
        } else if (y > height - regionHeight) {
          regions.bottom += brightness;
        }

        if (x < regionWidth) {
          regions.left += brightness;
        } else if (x > width - regionWidth) {
          regions.right += brightness;
        }

        if (x > regionWidth && x < width - regionWidth &&
            y > regionHeight && y < height - regionHeight) {
          regions.center += brightness;
        }
      }
    }

    // 평균 계산
    const topPixelCount = regionHeight * width;
    const bottomPixelCount = regionHeight * width;
    const leftPixelCount = height * regionWidth;
    const rightPixelCount = height * regionWidth;
    const centerPixelCount = (height - 2 * regionHeight) * (width - 2 * regionWidth);

    regions.top /= topPixelCount;
    regions.bottom /= bottomPixelCount;
    regions.left /= leftPixelCount;
    regions.right /= rightPixelCount;
    regions.center /= centerPixelCount;

    return regions;
  }

  // 눈 감지 및 추적 (개선된 알고리즘)
  detectAndTrackEyes(data, width, height) {
    // 1. 얼굴 영역 찾기
    const faceRegion = this.findFaceRegion(data, width, height);

    if (!faceRegion) return null;

    // 2. 눈 추적 모드 결정
    if (!this.eyeTrackingState.isCalibrated) {
      // 초기 캘리브레이션 모드: 눈을 찾아서 중앙에 맞추기
      return this.calibrateEyePosition(data, width, height, faceRegion);
    } else {
      // 추적 모드: 이전 위치를 기반으로 눈 추적
      return this.trackEyePosition(data, width, height, faceRegion);
    }
  }

  calibrateEyePosition(data, width, height, faceRegion) {
    // 여러 프레임 동안 눈 위치를 수집해서 평균을 구함
    const eyeRegions = this.findEyesInFaceRegion(data, width, height, faceRegion);

    if (eyeRegions && eyeRegions.leftEye && eyeRegions.rightEye &&
        eyeRegions.leftEye.confidence > 0.3 && eyeRegions.rightEye.confidence > 0.3) {

      const leftEye = eyeRegions.leftEye;
      const rightEye = eyeRegions.rightEye;

      // 눈 위치 평균 계산 (눈동자 중심 사용)
      const eyeCenterX = (leftEye.x + leftEye.width / 2 + rightEye.x + rightEye.width / 2) / 2;
      const eyeCenterY = (leftEye.y + leftEye.height / 2 + rightEye.y + rightEye.height / 2) / 2;

      // 눈 간 거리 검증
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);
      const expectedMinDistance = faceRegion.width * 0.15;
      const expectedMaxDistance = faceRegion.width * 0.35;

      if (eyeDistance < expectedMinDistance || eyeDistance > expectedMaxDistance) {
        console.log(`캘리브레이션: 눈 간 거리가 부적절함 (${eyeDistance}px, 예상: ${expectedMinDistance}-${expectedMaxDistance}px)`);
        return eyeRegions;
      }

      // 눈 위치가 얼굴 영역 내에 있는지 검증
      const faceCenterX = faceRegion.x + faceRegion.width / 2;
      const faceCenterY = faceRegion.y + faceRegion.height / 2;
      const maxDeviationX = faceRegion.width * 0.4;
      const maxDeviationY = faceRegion.height * 0.3;

      if (Math.abs(eyeCenterX - faceCenterX) > maxDeviationX ||
          Math.abs(eyeCenterY - faceCenterY) > maxDeviationY) {
        console.log('캘리브레이션: 눈 위치가 얼굴 영역을 벗어남');
        return eyeRegions;
      }

      if (!this.eyeTrackingState.lastEyePosition) {
        this.eyeTrackingState.lastEyePosition = { x: eyeCenterX, y: eyeCenterY };
        this.eyeTrackingState.eyeDistance = eyeDistance;
        this.eyeTrackingState.calibrationFrames = 1;
      } else {
        // 이동 평균 계산 (더 안정적인 스무딩)
        const alpha = 0.2; // 스무딩 계수 (더 낮게 설정하여 안정성 향상)

        // 이전 위치와의 거리가 너무 멀지 않은 경우에만 업데이트
        const distanceFromLast = Math.sqrt(
          Math.pow(eyeCenterX - this.eyeTrackingState.lastEyePosition.x, 2) +
          Math.pow(eyeCenterY - this.eyeTrackingState.lastEyePosition.y, 2)
        );

        const maxMovement = faceRegion.width * 0.1; // 최대 이동 거리 제한

        if (distanceFromLast < maxMovement) {
          this.eyeTrackingState.lastEyePosition.x =
            alpha * eyeCenterX + (1 - alpha) * this.eyeTrackingState.lastEyePosition.x;
          this.eyeTrackingState.lastEyePosition.y =
            alpha * eyeCenterY + (1 - alpha) * this.eyeTrackingState.lastEyePosition.y;

          // 눈 간 거리도 함께 평균화
          this.eyeTrackingState.eyeDistance =
            alpha * eyeDistance + (1 - alpha) * this.eyeTrackingState.eyeDistance;

          this.eyeTrackingState.calibrationFrames++;
        } else {
          console.log(`캘리브레이션: 눈 위치 이동이 너무 큼 (${distanceFromLast.toFixed(1)}px)`);
        }
      }

      // 충분한 프레임을 수집했으면 캘리브레이션 완료
      if (this.eyeTrackingState.calibrationFrames >= this.eyeTrackingState.maxCalibrationFrames) {
        this.eyeTrackingState.isCalibrated = true;
        console.log('눈 위치 캘리브레이션 완료:', {
          position: this.eyeTrackingState.lastEyePosition,
          eyeDistance: this.eyeTrackingState.eyeDistance.toFixed(1),
          frames: this.eyeTrackingState.calibrationFrames
        });
      }
    } else {
      console.log('캘리브레이션: 눈을 찾지 못했거나 신뢰도가 낮음');
    }

    return eyeRegions;
  }

  trackEyePosition(data, width, height, faceRegion) {
    // 캘리브레이션된 위치를 기반으로 눈 추적
    const lastPos = this.eyeTrackingState.lastEyePosition;
    const lastEyeDistance = this.eyeTrackingState.eyeDistance;

    if (!lastPos || !lastEyeDistance) return null;

    // 1단계: 얼굴 영역에서 눈을 다시 찾기 시도 (더 정확한 방법)
    const fullEyeRegions = this.findEyesInFaceRegion(data, width, height, faceRegion);

    if (fullEyeRegions && fullEyeRegions.leftEye && fullEyeRegions.rightEye &&
        fullEyeRegions.leftEye.confidence > 0.2 && fullEyeRegions.rightEye.confidence > 0.2) {

      const leftEye = fullEyeRegions.leftEye;
      const rightEye = fullEyeRegions.rightEye;

      // 눈 간 거리 검증
      const currentEyeDistance = Math.abs(rightEye.x - leftEye.x);
      const distanceRatio = currentEyeDistance / lastEyeDistance;

      // 눈 간 거리가 크게 변하지 않았는지 확인 (얼굴 회전이나 거리 변화 감지)
      if (distanceRatio > 0.7 && distanceRatio < 1.4) {
        const eyeCenterX = (leftEye.x + leftEye.width / 2 + rightEye.x + rightEye.width / 2) / 2;
        const eyeCenterY = (leftEye.y + leftEye.height / 2 + rightEye.y + rightEye.height / 2) / 2;

        // 이전 위치와의 거리 확인
        const distanceFromLast = Math.sqrt(
          Math.pow(eyeCenterX - lastPos.x, 2) +
          Math.pow(eyeCenterY - lastPos.y, 2)
        );

        const maxTrackingDistance = Math.max(100, lastEyeDistance * 0.5); // 최소 100px, 눈 간 거리의 0.5배

        if (distanceFromLast < maxTrackingDistance) {
          // 안정적인 추적 업데이트
          const alpha = 0.3; // 추적 모드에서는 더 빠른 반응성
          this.eyeTrackingState.lastEyePosition.x =
            alpha * eyeCenterX + (1 - alpha) * this.eyeTrackingState.lastEyePosition.x;
          this.eyeTrackingState.lastEyePosition.y =
            alpha * eyeCenterY + (1 - alpha) * this.eyeTrackingState.lastEyePosition.y;

          // 눈 간 거리도 업데이트
          this.eyeTrackingState.eyeDistance =
            alpha * currentEyeDistance + (1 - alpha) * this.eyeTrackingState.eyeDistance;

          console.log(`눈 추적 성공: 거리=${distanceFromLast.toFixed(1)}px, 눈간격=${currentEyeDistance.toFixed(1)}px`);
          return fullEyeRegions;
        } else {
          console.log(`눈 추적 실패: 이전 위치와 거리가 너무 멀음 (${distanceFromLast.toFixed(1)}px > ${maxTrackingDistance.toFixed(1)}px)`);
        }
      } else {
        console.log(`눈 추적 실패: 눈 간 거리 비율 이상 (${distanceRatio.toFixed(2)}, 예상: 0.7-1.4)`);
      }
    }

    // 2단계: Fallback - 이전 위치 주변에서 눈 검색
    console.log('얼굴 영역 검색 실패, 이전 위치 주변에서 재검색');
    const searchRadius = Math.max(30, lastEyeDistance * 0.3);
    const searchRegion = {
      x: Math.max(0, lastPos.x - searchRadius),
      y: Math.max(0, lastPos.y - searchRadius),
      width: Math.min(width - (lastPos.x - searchRadius), searchRadius * 2),
      height: Math.min(height - (lastPos.y - searchRadius), searchRadius * 2)
    };

    const fallbackEyes = this.findEyesInRegion(data, width, height, searchRegion);

    if (fallbackEyes && fallbackEyes.leftEye && fallbackEyes.rightEye) {
      console.log('Fallback 눈 검색 성공');
      return fallbackEyes;
    }

    console.log('눈 추적 실패: 어떠한 방법으로도 눈을 찾지 못함');
    return null;
  }

  findEyesInRegion(data, width, height, searchRegion) {
    // 검색 영역 내에서 눈 특징을 찾는 간단한 알고리즘
    const eyeWidth = Math.floor(searchRegion.width * 0.3);
    const eyeHeight = Math.floor(searchRegion.height * 0.4);
    const eyeSpacing = Math.floor(searchRegion.width * 0.4);

    // 왼쪽 눈 검색
    const leftEyeX = searchRegion.x + (searchRegion.width - eyeSpacing) / 2 - eyeWidth / 2;
    const rightEyeX = leftEyeX + eyeSpacing;
    const eyeY = searchRegion.y + searchRegion.height * 0.3;

    const leftEye = this.analyzeEyeRegion(data, width, height,
      leftEyeX, eyeY, eyeWidth, eyeHeight);
    const rightEye = this.analyzeEyeRegion(data, width, height,
      rightEyeX, eyeY, eyeWidth, eyeHeight);

    return {
      leftEye: leftEye,
      rightEye: rightEye
    };
  }

  findFaceRegion(data, width, height) {
    // 최적화된 간단한 얼굴 영역 감지 (RGB 기반으로 간소화)
    let skinPixels = 0;
    let centerX = 0, centerY = 0;
    const skinMap = new Uint8Array(width * height); // 디버그용 피부톤 맵

    // 중앙 영역 샘플링으로 성능 개선 (전체 픽셀 대신 1/4만 검사)
    const step = 2; // 2픽셀마다 검사하여 성능 개선
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 간소화된 피부톤 감지 (RGB 기반)
        const isSkin = r > 60 && g > 40 && b > 20 &&
                      r > g && r > b &&
                      Math.abs(r - g) < 50 &&
                      r / Math.max(g, b) < 2.5;

        skinMap[y * width + x] = isSkin ? 1 : 0;

        if (isSkin) {
          skinPixels++;
          centerX += x;
          centerY += y;
        }
      }
    }

    if (skinPixels > (width * height) / (step * step * 50)) { // 최소 피부톤 픽셀 수
      centerX /= skinPixels;
      centerY /= skinPixels;

      // 얼굴 크기 추정 (화면 크기의 1/3 정도로 가정)
      const faceSize = Math.min(width, height) / 3;
      const faceRegion = {
        x: Math.max(0, centerX - faceSize / 2),
        y: Math.max(0, centerY - faceSize / 2),
        width: Math.min(width - (centerX - faceSize / 2), faceSize),
        height: Math.min(height - (centerY - faceSize / 2), faceSize),
        skinMap: skinMap, // 디버그용 피부톤 맵 추가
        skinPixels: skinPixels,
        totalSamples: (width * height) / (step * step)
      };

      return faceRegion;
    }

    // 얼굴을 찾지 못한 경우 중앙 영역 반환 (fallback)
    return {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.25),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.5),
      skinMap: skinMap, // 디버그용 피부톤 맵 추가
      skinPixels: skinPixels,
      totalSamples: (width * height) / (step * step)
    };
  }

  // 불필요한 함수들 제거됨 (성능 최적화)

  // 불필요한 함수들 제거됨 (성능 최적화)

  findEyesInFaceRegion(data, width, height, faceRegion) {
    // 더 넓은 영역에서 눈을 검색하는 간단한 방법
    const eyeRegions = {
      leftEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 },
      rightEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 }
    };

    if (!faceRegion) return eyeRegions;

    // 얼굴 영역의 상단 2/3 영역에서 눈을 검색 (더 넓은 범위)
    const searchTop = faceRegion.y;
    const searchBottom = faceRegion.y + faceRegion.height * 0.6;
    const searchLeft = faceRegion.x;
    const searchRight = faceRegion.x + faceRegion.width;

    // 어두운 영역 찾기 (눈동자 후보)
    const darkRegions = [];

    // 4x4 그리드로 검색하여 성능 개선
    const gridSize = 4;
    const cellWidth = (searchRight - searchLeft) / gridSize;
    const cellHeight = (searchBottom - searchTop) / gridSize;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const cellX = searchLeft + gx * cellWidth;
        const cellY = searchTop + gy * cellHeight;

        if (cellX >= 0 && cellY >= 0 && cellX + cellWidth < width && cellY + cellHeight < height) {
          const avgBrightness = this.getRegionBrightness(data, width, height,
            cellX, cellY, cellWidth, cellHeight);

          // 어두운 영역을 눈 후보로 저장 (더 낮은 임계값으로 변경)
          if (avgBrightness < 150) {
            darkRegions.push({
              x: cellX,
              y: cellY,
              width: cellWidth,
              height: cellHeight,
              brightness: avgBrightness
            });
          }
        }
      }
    }

    // 가장 어두운 두 영역을 눈으로 선택
    if (darkRegions.length >= 2) {
      darkRegions.sort((a, b) => a.brightness - b.brightness);

      // 얼굴 중심을 기준으로 좌우 분류
      const faceCenterX = faceRegion.x + faceRegion.width / 2;

      const leftCandidates = darkRegions.filter(region => region.x + region.width / 2 < faceCenterX);
      const rightCandidates = darkRegions.filter(region => region.x + region.width / 2 > faceCenterX);

      if (leftCandidates.length > 0) {
        const leftEye = leftCandidates[0];
        eyeRegions.leftEye = {
          x: leftEye.x,
          y: leftEye.y,
          width: leftEye.width,
          height: leftEye.height,
          confidence: Math.max(0.1, 1 - leftEye.brightness / 255)
        };
      }

      if (rightCandidates.length > 0) {
        const rightEye = rightCandidates[0];
        eyeRegions.rightEye = {
          x: rightEye.x,
          y: rightEye.y,
          width: rightEye.width,
          height: rightEye.height,
          confidence: Math.max(0.1, 1 - rightEye.brightness / 255)
        };
      }
    }

    return eyeRegions;
  }

  getRegionBrightness(data, width, height, x, y, w, h) {
    // 지정된 영역의 평균 밝기 계산
    let totalBrightness = 0;
    let pixelCount = 0;

    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(width, Math.floor(x + w));
    const endY = Math.min(height, Math.floor(y + h));

    for (let cy = startY; cy < endY; cy += 2) { // 2픽셀마다 샘플링
      for (let cx = startX; cx < endX; cx += 2) {
        const idx = (cy * width + cx) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        totalBrightness += brightness;
        pixelCount++;
      }
    }

    return pixelCount > 0 ? totalBrightness / pixelCount : 255;
  }

  // 개선된 눈 감지 (더 정확한 그리드 기반 방식)
  detectEyesWithTracking(data, width, height) {
    // tracking.js 대신 개선된 기존 알고리즘 사용
    const faceRegion = this.findFaceRegion(data, width, height);
    return this.findEyesInFaceRegion(data, width, height, faceRegion);
  }

  estimateGazeY(regions, screenHeight) {
    // 개선된 시선 추정 알고리즘
    // 밝기 차이와 영역별 가중치를 사용하여 더 정확한 추정

    // 각 영역의 밝기를 정규화 (0-1)
    const topBrightness = regions.top / 255;
    const bottomBrightness = regions.bottom / 255;
    const centerBrightness = regions.center / 255;

    // 밝기 차이 계산
    const verticalDiff = topBrightness - bottomBrightness;

    // 시선 위치 계산 (로그 함수를 사용하여 더 자연스러운 응답)
    let gazeRatio;

    if (Math.abs(verticalDiff) < 0.1) {
      // 밝기 차이가 작으면 중앙으로
      gazeRatio = 0.5;
    } else {
      // 밝기 차이에 따라 시선 위치 조정
      gazeRatio = 0.5 + (Math.sign(verticalDiff) * Math.log(Math.abs(verticalDiff) + 1) * 0.2);
      gazeRatio = Math.max(0.1, Math.min(0.9, gazeRatio)); // 0.1 ~ 0.9 범위로 제한
    }

    // 화면 높이에 적용
    const gazeY = screenHeight * gazeRatio;

    // 디버그 정보 (개발자 콘솔에서 확인 가능)
    if (this.settings.debugMode) {
      console.log('시선 추정:', {
        topBrightness: topBrightness.toFixed(3),
        bottomBrightness: bottomBrightness.toFixed(3),
        verticalDiff: verticalDiff.toFixed(3),
        gazeRatio: gazeRatio.toFixed(3),
        gazeY: gazeY.toFixed(1)
      });
    }

    return gazeY;
  }

  sendDebugInfo(regions, currentBrightness, previousBrightness, gazeY, screenHeight, eyeRegions) {
    // 시선 위치를 0-1 범위로 정규화
    const gazeRatio = gazeY / screenHeight;
    const brightnessDiff = currentBrightness - previousBrightness;

    // 시선 위치 텍스트 변환
    let gazePositionText = '중앙';
    if (gazeRatio < 0.3) {
      gazePositionText = '상단';
    } else if (gazeRatio > 0.7) {
      gazePositionText = '하단';
    }

    // 얼굴 감지 상태 확인
    const faceDetectionStatus = this.getFaceDetectionStatus();

    // 눈 추적 품질 평가
    const eyeTrackingQuality = this.evaluateEyeTrackingQuality(eyeRegions);

    // 현재 프레임에서 찾은 얼굴 영역 (디버그용)
    const currentFaceRegion = this.findFaceRegion(this.ctx.getImageData(0, 0, 640, 480).data, 640, 480);

    // 디버그 데이터 구성
    const debugData = {
      gazePosition: gazePositionText,
      gazeX: 0.5, // 중앙 고정 (단순화)
      gazeY: gazeRatio,
      brightnessDiff: brightnessDiff.toFixed(2),
      scrollDirection: this.scrollDirection,
      acceleration: this.scrollAcceleration.toFixed(2),
      regions: {
        top: (regions.top / 255).toFixed(3),
        bottom: (regions.bottom / 255).toFixed(3),
        center: (regions.center / 255).toFixed(3)
      },
      faceDetection: faceDetectionStatus,
      currentFaceRegion: currentFaceRegion ? {
        x: currentFaceRegion.x,
        y: currentFaceRegion.y,
        width: currentFaceRegion.width,
        height: currentFaceRegion.height,
        skinPixels: currentFaceRegion.skinPixels,
        totalSamples: currentFaceRegion.totalSamples,
        skinPercentage: ((currentFaceRegion.skinPixels / currentFaceRegion.totalSamples) * 100).toFixed(1)
      } : null,
      eyeTracking: {
        quality: eyeTrackingQuality,
        isCalibrated: this.eyeTrackingState.isCalibrated,
        calibrationFrames: this.eyeTrackingState.calibrationFrames,
        lastEyePosition: this.eyeTrackingState.lastEyePosition,
        eyeDistance: this.eyeTrackingState.eyeDistance ? this.eyeTrackingState.eyeDistance.toFixed(1) : null,
        regions: eyeRegions ? {
          leftEye: {
            x: eyeRegions.leftEye.x,
            y: eyeRegions.leftEye.y,
            width: eyeRegions.leftEye.width,
            height: eyeRegions.leftEye.height,
            confidence: eyeRegions.leftEye.confidence
          },
          rightEye: {
            x: eyeRegions.rightEye.x,
            y: eyeRegions.rightEye.y,
            width: eyeRegions.rightEye.width,
            height: eyeRegions.rightEye.height,
            confidence: eyeRegions.rightEye.confidence
          }
        } : null
      },
      systemStatus: {
        isActive: this.isActive,
        isCalibrating: this.isCalibrating,
        debugMode: this.settings.debugMode,
        mirrorMode: this.settings.mirrorMode
      }
    };

    // 디버그 모드에서 캔버스 이미지 캡처 (항상 캡처하도록 수정)
    if (this.settings.debugMode && this.canvas) {
      try {
        const imageData = this.canvas.toDataURL('image/jpeg', 0.8); // 품질 높임
        debugData.frameImage = imageData;
      } catch (error) {
        console.warn('디버그 이미지 캡처 실패:', error);
      }
    }

    // popup으로 디버그 정보 전송
    try {
      chrome.runtime.sendMessage({
        action: 'debugUpdate',
        data: debugData
      }, function(response) {
        if (chrome.runtime.lastError) {
          // 디버그 모드가 비활성화되었거나 popup이 닫힌 경우
          console.warn('디버그 정보 전송 실패:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      // 메시지 채널이 닫힌 경우
      console.warn('디버그 메시지 전송 중 오류:', error);
    }
  }

  getFaceDetectionStatus() {
    // 얼굴 감지 상태를 요약
    if (!this.eyeTrackingState.lastEyePosition) {
      return {
        status: 'no_face',
        message: '얼굴을 찾지 못함',
        confidence: 0
      };
    }

    if (!this.eyeTrackingState.isCalibrated) {
      return {
        status: 'calibrating',
        message: `캘리브레이션 중... (${this.eyeTrackingState.calibrationFrames}/${this.eyeTrackingState.maxCalibrationFrames})`,
        confidence: this.eyeTrackingState.calibrationFrames / this.eyeTrackingState.maxCalibrationFrames
      };
    }

    return {
      status: 'tracking',
      message: '얼굴 추적 중',
      confidence: 1.0,
      eyeDistance: this.eyeTrackingState.eyeDistance ? this.eyeTrackingState.eyeDistance.toFixed(1) : null
    };
  }

  evaluateEyeTrackingQuality(eyeRegions) {
    if (!eyeRegions || !eyeRegions.leftEye || !eyeRegions.rightEye) {
      return {
        score: 0,
        status: 'no_eyes',
        message: '눈을 찾지 못함'
      };
    }

    const leftConfidence = eyeRegions.leftEye.confidence;
    const rightConfidence = eyeRegions.rightEye.confidence;
    const avgConfidence = (leftConfidence + rightConfidence) / 2;

    const eyeDistance = Math.abs(eyeRegions.rightEye.x - eyeRegions.leftEye.x);
    const expectedDistance = this.eyeTrackingState.eyeDistance || 100;
    const distanceRatio = eyeDistance / expectedDistance;

    let qualityScore = avgConfidence;
    let status = 'good';
    let message = '양호';

    // 신뢰도에 따른 품질 평가
    if (avgConfidence < 0.3) {
      qualityScore *= 0.5;
      status = 'poor';
      message = '눈 감지 신뢰도가 낮음';
    } else if (avgConfidence < 0.6) {
      qualityScore *= 0.8;
      status = 'fair';
      message = '눈 감지 신뢰도가 보통';
    }

    // 눈 간 거리에 따른 품질 평가
    if (distanceRatio < 0.7 || distanceRatio > 1.4) {
      qualityScore *= 0.7;
      status = status === 'good' ? 'fair' : 'poor';
      message += ', 눈 간 거리 비정상';
    }

    // 좌우 눈 신뢰도 차이에 따른 품질 평가
    const confidenceDiff = Math.abs(leftConfidence - rightConfidence);
    if (confidenceDiff > 0.3) {
      qualityScore *= 0.9;
      message += ', 좌우 눈 감지 불균형';
    }

    return {
      score: Math.max(0, Math.min(1, qualityScore)),
      status: status,
      message: message,
      details: {
        avgConfidence: avgConfidence.toFixed(3),
        distanceRatio: distanceRatio.toFixed(2),
        confidenceDiff: confidenceDiff.toFixed(3)
      }
    };
  }

  performScroll() {
    const scrollAmount = this.settings.scrollSpeed * this.scrollAcceleration;

    if (this.scrollDirection === -1) {
      // 위로 스크롤
      window.scrollBy({
        top: -scrollAmount,
        behavior: 'smooth'
      });
    } else if (this.scrollDirection === 1) {
      // 아래로 스크롤
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }



  showNotification(message, type = 'info') {
    // 간단한 알림 표시
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#3742fa'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
      ${message}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-in reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 초기화
const gazeScroll = new GazeScroll();
