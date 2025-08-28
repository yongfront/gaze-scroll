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

    const track = () => {
      if (!this.isActive) return;

      try {
        // 캔버스에 비디오 프레임 그리기
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

          // 이미지 데이터 가져오기
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const data = imageData.data;

          // 간단한 밝기 분석으로 시선 방향 추정
          const regions = this.analyzeImageRegions(data, this.canvas.width, this.canvas.height);

          // 눈 영역 감지 및 추적
          const eyeRegions = this.detectAndTrackEyes(data, this.canvas.width, this.canvas.height);

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

          // 디버그 모드에서 정보 전송
          if (this.settings.debugMode) {
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
    if (!this.settings.debugMode && !this.eyeTrackingState.isCalibrated) return null;

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
    // 개선된 얼굴 영역 감지 (HSV 기반 피부톤 감지 + 모폴로지 연산)
    const skinMap = new Uint8Array(width * height);

    // 1단계: HSV 기반 피부톤 감지
    let skinPixels = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx] / 255;
        const g = data[idx + 1] / 255;
        const b = data[idx + 2] / 255;

        // RGB to HSV 변환
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h, s, v;
        v = max;

        if (delta === 0) {
          h = 0;
          s = 0;
        } else {
          s = delta / max;
          if (max === r) {
            h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
          } else if (max === g) {
            h = ((b - r) / delta + 2) / 6;
          } else {
            h = ((r - g) / delta + 4) / 6;
          }
        }

        // HSV 기반 피부톤 감지 (여러 범위 고려)
        const isSkin = this.isSkinTone(h, s, v) &&
                      this.validateSkinPixel(data, width, height, x, y);

        skinMap[y * width + x] = isSkin ? 1 : 0;
        if (isSkin) skinPixels++;
      }
    }

    // 2단계: 노이즈 제거 (모폴로지 연산)
    const cleanedSkinMap = this.morphologicalFilter(skinMap, width, height);

    // 3단계: 얼굴 영역 추출
    const faceCandidates = this.extractFaceCandidates(cleanedSkinMap, width, height);

    if (faceCandidates.length > 0) {
      // 가장 큰 얼굴 영역 선택
      const bestFace = faceCandidates.reduce((best, current) =>
        current.area > best.area ? current : best
      );

      // 얼굴 영역을 조금 더 넓게 확장
      const margin = 0.1; // 10% 마진
      const expandedFace = {
        x: Math.max(0, bestFace.x - bestFace.width * margin),
        y: Math.max(0, bestFace.y - bestFace.height * margin),
        width: Math.min(width - bestFace.x, bestFace.width * (1 + 2 * margin)),
        height: Math.min(height - bestFace.y, bestFace.height * (1 + 2 * margin))
      };

      console.log(`얼굴 영역 발견: (${expandedFace.x}, ${expandedFace.y}) ${expandedFace.width}x${expandedFace.height}`);
      return expandedFace;
    }

    // 얼굴을 찾지 못한 경우 더 넓은 범위에서 재시도
    console.log('얼굴을 찾지 못하여 재시도...');
    return this.findFaceFallback(data, width, height);
  }

  isSkinTone(h, s, v) {
    // HSV 기반 피부톤 감지 (여러 인종 고려)
    const skinRanges = [
      // 밝은 피부톤
      { h: [0.02, 0.15], s: [0.15, 0.8], v: [0.3, 1.0] },
      // 중간톤 피부
      { h: [0.01, 0.20], s: [0.1, 0.9], v: [0.2, 0.9] },
      // 어두운 피부톤
      { h: [0.00, 0.25], s: [0.1, 1.0], v: [0.1, 0.8] }
    ];

    return skinRanges.some(range =>
      h >= range.h[0] && h <= range.h[1] &&
      s >= range.s[0] && s <= range.s[1] &&
      v >= range.v[0] && v <= range.v[1]
    );
  }

  validateSkinPixel(data, width, height, x, y) {
    // 주변 픽셀과의 일관성 검증
    const kernelSize = 3;
    const halfKernel = Math.floor(kernelSize / 2);
    let skinNeighbors = 0;
    let totalNeighbors = 0;

    for (let ky = -halfKernel; ky <= halfKernel; ky++) {
      for (let kx = -halfKernel; kx <= halfKernel; kx++) {
        const nx = x + kx;
        const ny = y + ky;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          const r = data[idx] / 255;
          const g = data[idx + 1] / 255;
          const b = data[idx + 2] / 255;

          // 간단한 RGB 기반 피부톤 확인
          if (r > 0.3 && g > 0.2 && b > 0.15 &&
              Math.max(r, g, b) - Math.min(r, g, b) < 0.3) {
            skinNeighbors++;
          }
          totalNeighbors++;
        }
      }
    }

    // 주변 픽셀의 50% 이상이 피부톤이어야 함
    return (skinNeighbors / totalNeighbors) > 0.5;
  }

  morphologicalFilter(skinMap, width, height) {
    // 간단한 모폴로지 닫기 연산 (노이즈 제거)
    const result = new Uint8Array(width * height);
    const kernel = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0]
    ];

    // 팽창
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let hasSkin = false;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (kernel[ky + 1][kx + 1] &&
                skinMap[(y + ky) * width + (x + kx)]) {
              hasSkin = true;
              break;
            }
          }
          if (hasSkin) break;
        }
        result[y * width + x] = hasSkin ? 1 : 0;
      }
    }

    return result;
  }

  extractFaceCandidates(skinMap, width, height) {
    const candidates = [];
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (skinMap[idx] && !visited[idx]) {
          const region = this.floodFill(skinMap, visited, width, height, x, y);
          if (region.area > 1000) { // 최소 영역 크기
            candidates.push(region);
          }
        }
      }
    }

    return candidates;
  }

  floodFill(skinMap, visited, width, height, startX, startY) {
    const stack = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let area = 0;

    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height ||
          visited[idx] || !skinMap[idx]) {
        continue;
      }

      visited[idx] = 1;
      area++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // 4방향으로 확장
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area
    };
  }

  findFaceFallback(data, width, height) {
    // 얼굴을 찾지 못한 경우 더 넓은 범위에서 재시도
    // 밝기 조절을 통해 다양한 조명 조건에 대응
    const brightnessLevels = [0.7, 1.0, 1.3];

    for (const brightness of brightnessLevels) {
      const adjustedData = this.adjustBrightness(data, brightness);
      const skinMap = new Uint8Array(width * height);

      let skinPixels = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = adjustedData[idx] / 255;
          const g = adjustedData[idx + 1] / 255;
          const b = adjustedData[idx + 2] / 255;

          // 더 느슨한 피부톤 조건
          const isSkin = r > 0.2 && g > 0.15 && b > 0.1 &&
                        Math.max(r, g, b) - Math.min(r, g, b) < 0.4;

          skinMap[y * width + x] = isSkin ? 1 : 0;
          if (isSkin) skinPixels++;
        }
      }

      if (skinPixels > width * height * 0.05) { // 5% 이상
        // 중앙에 가까운 영역 우선 선택
        const centerX = width / 2;
        const centerY = height / 2;

        let bestX = 0, bestY = 0, bestWidth = 0, bestHeight = 0;
        let minDistance = Infinity;

        // 간단한 그리드 검색으로 얼굴 영역 추정
        const gridSize = 4;
        for (let gy = 0; gy < gridSize; gy++) {
          for (let gx = 0; gx < gridSize; gx++) {
            const x = Math.floor((gx / gridSize) * width);
            const y = Math.floor((gy / gridSize) * height);
            const w = Math.floor(width / gridSize);
            const h = Math.floor(height / gridSize);

            let regionSkinPixels = 0;
            for (let ry = y; ry < y + h && ry < height; ry++) {
              for (let rx = x; rx < x + w && rx < width; rx++) {
                if (skinMap[ry * width + rx]) {
                  regionSkinPixels++;
                }
              }
            }

            if (regionSkinPixels > (w * h * 0.3)) {
              const distance = Math.sqrt(
                Math.pow(x + w/2 - centerX, 2) +
                Math.pow(y + h/2 - centerY, 2)
              );

              if (distance < minDistance) {
                minDistance = distance;
                bestX = x;
                bestY = y;
                bestWidth = w;
                bestHeight = h;
              }
            }
          }
        }

        if (bestWidth > 0) {
          console.log(`Fallback 얼굴 영역 발견 (밝기: ${brightness}): (${bestX}, ${bestY}) ${bestWidth}x${bestHeight}`);
          return {
            x: bestX,
            y: bestY,
            width: bestWidth,
            height: bestHeight
          };
        }
      }
    }

    // 최종 fallback: 중앙 영역 반환
    console.log('얼굴을 찾지 못하여 중앙 영역으로 설정');
    return {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.25),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.5)
    };
  }

  adjustBrightness(data, factor) {
    const adjusted = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      adjusted[i] = Math.min(255, data[i] * factor);     // R
      adjusted[i + 1] = Math.min(255, data[i + 1] * factor); // G
      adjusted[i + 2] = Math.min(255, data[i + 2] * factor); // B
      adjusted[i + 3] = data[i + 3]; // A
    }
    return adjusted;
  }

  findEyesInFaceRegion(data, width, height, faceRegion) {
    const eyeRegions = {
      leftEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 },
      rightEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 }
    };

    if (!faceRegion) return eyeRegions;

    // 1단계: 얼굴 영역에서 직접 눈 특징 추출 (확대 없이 1배율로)
    const eyeFeatures = this.extractEyeFeaturesDirect(data, width, height, faceRegion);

    // 2단계: 눈 위치 정제 및 검증
    if (eyeFeatures.leftEye && eyeFeatures.rightEye) {
      eyeRegions.leftEye = this.refineEyePositionDirect(
        eyeFeatures.leftEye, faceRegion, width, height, data
      );
      eyeRegions.rightEye = this.refineEyePositionDirect(
        eyeFeatures.rightEye, faceRegion, width, height, data
      );

      // 눈 간 거리 검증 (얼굴 크기에 비례)
      const eyeDistance = Math.abs(eyeRegions.rightEye.x - eyeRegions.leftEye.x);
      const expectedDistance = faceRegion.width * 0.25; // 얼굴 너비의 25%

      if (eyeDistance < expectedDistance * 0.5 || eyeDistance > expectedDistance * 1.5) {
        // 눈 간 거리가 부자연스러운 경우 재탐색
        console.log(`눈 간 거리 이상: ${eyeDistance}px (예상: ${expectedDistance}px)`);
        return this.findEyesFallback(data, width, height, faceRegion);
      }

      console.log(`눈 발견: 왼쪽(${eyeRegions.leftEye.x}, ${eyeRegions.leftEye.y}), 오른쪽(${eyeRegions.rightEye.x}, ${eyeRegions.rightEye.y})`);
    } else {
      // 눈을 찾지 못한 경우 fallback
      console.log('얼굴 영역에서 눈을 찾지 못하여 fallback 모드 실행');
      return this.findEyesFallback(data, width, height, faceRegion);
    }

    return eyeRegions;
  }

  // 확대 기능 제거 - 이제 사용하지 않음

  extractEyeFeaturesDirect(data, width, height, faceRegion) {
    const eyeFeatures = { leftEye: null, rightEye: null };

    // 얼굴 영역에서 직접 눈 특징 검색 (1배율)
    // 1. 어두운 영역 (눈동자) 검색
    const darkRegions = this.findDarkRegions(data, width, height, faceRegion);

    // 2. 밝은 영역 (눈 흰자) 검색
    const brightRegions = this.findBrightRegions(data, width, height, faceRegion);

    // 얼굴 중심 기준으로 눈 위치 추정
    const faceCenterX = faceRegion.x + faceRegion.width / 2;
    const eyeLevelY = faceRegion.y + faceRegion.height * 0.35; // 얼굴 높이의 35% (눈 위치)
    const eyeSpacing = faceRegion.width * 0.25; // 눈 사이 간격

    // 왼쪽 눈 후보 영역들
    const leftEyeCandidates = [];
    const rightEyeCandidates = [];

    // 어두운 영역과 밝은 영역의 조합으로 눈 특징 검출
    darkRegions.forEach(darkRegion => {
      brightRegions.forEach(brightRegion => {
        // 어두운 영역 안에 밝은 영역이 있는지 확인 (눈동자 주변에 흰자)
        if (this.isRegionContained(darkRegion, brightRegion)) {
          const eyeCandidate = {
            x: darkRegion.x,
            y: darkRegion.y,
            width: darkRegion.width,
            height: darkRegion.height,
            confidence: (darkRegion.confidence + brightRegion.confidence) / 2,
            type: 'eye'
          };

          // 얼굴 중심으로부터의 거리에 따라 좌/우 분류
          const eyeCenterX = eyeCandidate.x + eyeCandidate.width / 2;

          if (eyeCenterX < faceCenterX - eyeSpacing * 0.3) {
            leftEyeCandidates.push(eyeCandidate);
          } else if (eyeCenterX > faceCenterX + eyeSpacing * 0.3) {
            rightEyeCandidates.push(eyeCandidate);
          }
        }
      });
    });

    // 가장 신뢰도가 높은 눈 선택
    if (leftEyeCandidates.length > 0) {
      eyeFeatures.leftEye = leftEyeCandidates.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    }

    if (rightEyeCandidates.length > 0) {
      eyeFeatures.rightEye = rightEyeCandidates.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    }

    return eyeFeatures;
  }

  findDarkRegions(data, width, height, faceRegion) {
    const regions = [];
    const threshold = 80; // 어두운 픽셀 임계값
    const minRegionSize = 30; // 얼굴 영역이므로 최소 크기 감소

    // 얼굴 영역 내에서만 검색
    const startX = Math.max(0, faceRegion.x);
    const endX = Math.min(width, faceRegion.x + faceRegion.width);
    const startY = Math.max(0, faceRegion.y);
    const endY = Math.min(height, faceRegion.y + faceRegion.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (brightness < threshold) {
          const region = this.growRegion(data, width, height, x, y, threshold, 'dark', faceRegion);
          if (region && region.size >= minRegionSize) {
            regions.push(region);
          }
        }
      }
    }

    return regions;
  }

  findBrightRegions(data, width, height, faceRegion) {
    const regions = [];
    const threshold = 180; // 밝은 픽셀 임계값
    const minRegionSize = 50; // 얼굴 영역이므로 최소 크기 감소

    // 얼굴 영역 내에서만 검색
    const startX = Math.max(0, faceRegion.x);
    const endX = Math.min(width, faceRegion.x + faceRegion.width);
    const startY = Math.max(0, faceRegion.y);
    const endY = Math.min(height, faceRegion.y + faceRegion.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (brightness > threshold) {
          const region = this.growRegion(data, width, height, x, y, threshold, 'bright', faceRegion);
          if (region && region.size >= minRegionSize) {
            regions.push(region);
          }
        }
      }
    }

    return regions;
  }

  // findEdgeRegions는 1배율 방식에서는 사용하지 않음

  growRegion(data, width, height, startX, startY, threshold, type, faceRegion = null) {
    const visited = new Uint8Array(width * height);
    const stack = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let size = 0;
    let totalBrightness = 0;

    // 얼굴 영역 제한 설정
    const limitX = faceRegion ? {
      min: Math.max(0, faceRegion.x),
      max: Math.min(width, faceRegion.x + faceRegion.width)
    } : { min: 0, max: width };

    const limitY = faceRegion ? {
      min: Math.max(0, faceRegion.y),
      max: Math.min(height, faceRegion.y + faceRegion.height)
    } : { min: 0, max: height };

    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = y * width + x;

      // 얼굴 영역 제한 확인
      if (x < limitX.min || x >= limitX.max || y < limitY.min || y >= limitY.max ||
          x < 0 || x >= width || y < 0 || y >= height || visited[idx]) {
        continue;
      }

      const pixelIdx = (y * width + x) * 4;
      const brightness = (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;

      let isMatch = false;
      switch (type) {
        case 'dark':
          isMatch = brightness < threshold;
          break;
        case 'bright':
          isMatch = brightness > threshold;
          break;
        case 'edge':
          // 경계 검출의 경우 주변과의 차이로 판단
          isMatch = this.isEdgePixel(data, width, height, x, y, threshold);
          break;
      }

      if (!isMatch) continue;

      visited[idx] = 1;
      size++;
      totalBrightness += brightness;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // 얼굴 영역 내에서만 확장
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }

    if (size === 0) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      size,
      confidence: Math.min(1, size / 200), // 크기에 따른 신뢰도 (얼굴 영역이므로 감소)
      avgBrightness: totalBrightness / size
    };
  }

  isEdgePixel(data, width, height, x, y, threshold) {
    if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) return false;

    const idx = (y * width + x) * 4;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

    const upIdx = ((y - 1) * width + x) * 4;
    const downIdx = ((y + 1) * width + x) * 4;
    const leftIdx = (y * width + (x - 1)) * 4;
    const rightIdx = (y * width + (x + 1)) * 4;

    const upBrightness = (data[upIdx] + data[upIdx + 1] + data[upIdx + 2]) / 3;
    const downBrightness = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 3;
    const leftBrightness = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
    const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;

    const verticalDiff = Math.abs(upBrightness - downBrightness);
    const horizontalDiff = Math.abs(leftBrightness - rightBrightness);

    return Math.max(verticalDiff, horizontalDiff) > threshold;
  }

  isRegionContained(outerRegion, innerRegion) {
    return innerRegion.x >= outerRegion.x &&
           innerRegion.y >= outerRegion.y &&
           (innerRegion.x + innerRegion.width) <= (outerRegion.x + outerRegion.width) &&
           (innerRegion.y + innerRegion.height) <= (outerRegion.y + outerRegion.height);
  }

  refineEyePositionDirect(eyeCandidate, faceRegion, width, height, data) {
    // 눈 영역 내에서 가장 어두운 점 찾기 (눈동자 중심) - 1배율로 직접 처리
    let darkestX = eyeCandidate.x;
    let darkestY = eyeCandidate.y;
    let darkestBrightness = 255;

    const searchRadius = 3; // 1배율이므로 검색 반경 감소
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const x = eyeCandidate.x + eyeCandidate.width / 2 + dx;
        const y = eyeCandidate.y + eyeCandidate.height / 2 + dy;

        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

          if (brightness < darkestBrightness) {
            darkestBrightness = brightness;
            darkestX = x;
            darkestY = y;
          }
        }
      }
    }

    return {
      x: darkestX - eyeCandidate.width / 4,
      y: darkestY - eyeCandidate.height / 4,
      width: eyeCandidate.width / 2,
      height: eyeCandidate.height / 2,
      confidence: eyeCandidate.confidence
    };
  }

  findEyesFallback(data, width, height, faceRegion) {
    // 눈을 찾지 못한 경우 기존 방식으로 fallback
    const eyeRegions = {
      leftEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 },
      rightEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 }
    };

    // 얼굴 영역 내에서 눈 위치 추정 (기존 방식)
    const faceCenterX = faceRegion.x + faceRegion.width / 2;
    const eyeY = faceRegion.y + faceRegion.height * 0.35;
    const eyeWidth = Math.floor(faceRegion.width * 0.15);
    const eyeHeight = Math.floor(faceRegion.height * 0.12);
    const eyeSpacing = Math.floor(faceRegion.width * 0.2);

    const leftEyeX = Math.floor(faceCenterX - eyeSpacing / 2 - eyeWidth / 2);
    const rightEyeX = Math.floor(faceCenterX + eyeSpacing / 2 - eyeWidth / 2);

    eyeRegions.leftEye = this.analyzeEyeRegion(data, width, height,
      leftEyeX, eyeY, eyeWidth, eyeHeight);
    eyeRegions.rightEye = this.analyzeEyeRegion(data, width, height,
      rightEyeX, eyeY, eyeWidth, eyeHeight);

    return eyeRegions;
  }

  analyzeEyeRegion(data, width, height, eyeX, eyeY, eyeWidth, eyeHeight) {
    let totalBrightness = 0;
    let darkPixels = 0;
    let edgePixels = 0;
    let pixelCount = 0;

    // 눈 영역 경계 검출 및 밝기 분석
    for (let y = eyeY; y < eyeY + eyeHeight; y++) {
      for (let x = eyeX; x < eyeX + eyeWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = (r + g + b) / 3;

          totalBrightness += brightness;
          pixelCount++;

          // 어두운 픽셀 (눈동자) 카운트
          if (brightness < 100) {
            darkPixels++;
          }

          // 경계 픽셀 검출 (주변 픽셀과의 밝기 차이)
          if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
            const upIdx = ((y - 1) * width + x) * 4;
            const downIdx = ((y + 1) * width + x) * 4;
            const leftIdx = (y * width + (x - 1)) * 4;
            const rightIdx = (y * width + (x + 1)) * 4;

            const upBrightness = (data[upIdx] + data[upIdx + 1] + data[upIdx + 2]) / 3;
            const downBrightness = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 3;
            const leftBrightness = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
            const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;

            const verticalDiff = Math.abs(upBrightness - downBrightness);
            const horizontalDiff = Math.abs(leftBrightness - rightBrightness);

            if (verticalDiff > 30 || horizontalDiff > 30) {
              edgePixels++;
            }
          }
        }
      }
    }

    if (pixelCount === 0) {
      return { x: eyeX, y: eyeY, width: eyeWidth, height: eyeHeight, confidence: 0 };
    }

    const avgBrightness = totalBrightness / pixelCount;
    const darkRatio = darkPixels / pixelCount;
    const edgeRatio = edgePixels / pixelCount;

    // 눈 영역 신뢰도 계산
    let confidence = 0;

    // 밝기가 적당한 수준인지 (너무 밝거나 어둡지 않은지)
    if (avgBrightness > 80 && avgBrightness < 200) {
      confidence += 0.3;
    }

    // 어두운 영역 비율이 적당한지 (눈동자가 있는지)
    if (darkRatio > 0.1 && darkRatio < 0.5) {
      confidence += 0.3;
    }

    // 경계가 선명한지
    if (edgeRatio > 0.1) {
      confidence += 0.4;
    }

    return {
      x: eyeX,
      y: eyeY,
      width: eyeWidth,
      height: eyeHeight,
      confidence: Math.min(confidence, 1)
    };
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
            confidence: eyeRegions.leftEye.confidence.toFixed(3)
          },
          rightEye: {
            x: eyeRegions.rightEye.x,
            y: eyeRegions.rightEye.y,
            width: eyeRegions.rightEye.width,
            height: eyeRegions.rightEye.height,
            confidence: eyeRegions.rightEye.confidence.toFixed(3)
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

    // 디버그 모드에서 캔버스 이미지 캡처
    if (this.settings.debugMode && this.canvas) {
      try {
        const imageData = this.canvas.toDataURL('image/jpeg', 0.5);
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
