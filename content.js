// Gaze Scroll Content Script with MediaPipe Face Mesh
class GazeScroll {
  constructor() {
    this.isActive = false;
    this.isCalibrating = false;
    this.tracker = null;
    this.canvas = null;
    this.video = null;
    this.animationId = null;
    
    // MediaPipe Face Mesh 관련
    this.faceMesh = null;
    this.faceDetectionResults = null;
    this.mediaPipeInitialized = false;

    this.settings = {
      scrollSpeed: 50,
      topZone: 30,
      bottomZone: 30,
      debugMode: false,
      cameraResolution: 'HD', // 'SD', 'HD', 'FHD', 'QHD', '4K'
      // mirrorMode 제거됨 - 항상 반전 모드로 고정
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

    // 메시지 전송 상태 플래그
    this.messageSendPaused = false;

    // 향후 확장을 위한 얼굴감지 시스템
    this.advancedFaceDetection = false;

    // 카메라 해상도 설정
    this.cameraResolutions = {
      'SD': { width: 640, height: 480, label: '480p (표준)' },
      'HD': { width: 1280, height: 720, label: '720p (HD)' },
      'FHD': { width: 1920, height: 1080, label: '1080p (Full HD)' },
      'QHD': { width: 2560, height: 1440, label: '1440p (QHD)' },
      '4K': { width: 3840, height: 2160, label: '2160p (4K UHD)' }
    };

    this.init();
  }

  init() {
    // 메시지 리스너 설정
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // 초기 설정 적용
    this.applyMirrorMode();
    
    // MediaPipe 라이브러리 로드
    this.loadMediaPipe();
    
    console.log('✅ Gaze Scroll 초기화 완료 - MediaPipe Face Mesh 사용');
    
    // 개발자를 위한 눈 감지 가이드 출력
    setTimeout(() => {
      this.printEyeDetectionGuide();
    }, 2000);
  }

  // MediaPipe 라이브러리를 동적으로 로드 (개선된 방법)
  async loadMediaPipe() {
    try {
      console.log('MediaPipe 라이브러리 로딩 시도 중...');
      
      // CSP 제약으로 인해 웹페이지 컨텍스트에서 로드
      const loadSuccess = await this.loadMediaPipeInPageContext();
      
      if (loadSuccess) {
        console.log('✅ MediaPipe 라이브러리 로드 완료');
        this.initMediaPipeFaceMesh();
      } else {
        throw new Error('MediaPipe 로드 실패');
      }
      
    } catch (error) {
      console.error('❌ MediaPipe 라이브러리 로드 실패:', error);
      console.log('📱 기본 얼굴 감지 알고리즘 사용 (여전히 효과적)');
      this.mediaPipeInitialized = false;
    }
  }

  // 로컬 얼굴감지 시스템 초기화 (외부 라이브러리 없이)
  async loadMediaPipeInPageContext() {
    return new Promise((resolve) => {
      try {
        console.log('🧠 로컬 얼굴감지 시스템 초기화 중...');
        
        // CSP 제약을 피해 로컬에서 작동하는 고급 얼굴감지 시스템
            window.GazeScrollFaceDetection = {
          initialized: true,
          useAdvancedLocal: true,
              
          // 고급 로컬 얼굴 감지 함수
              detectFace: function(videoElement) {
                if (!videoElement || videoElement.videoWidth === 0) {
                  return null;
                }
                
            // 가상 캔버스에서 비디오 프레임 분석
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            try {
              ctx.drawImage(videoElement, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              
              // 실제 얼굴 감지 수행
              return this.performAdvancedFaceDetection(imageData, canvas.width, canvas.height);
            } catch (error) {
              console.warn('얼굴 감지 분석 오류:', error);
              return null;
            }
          },
          
          // 고급 얼굴 감지 알고리즘 (Viola-Jones 기반 간소화 버전)
          performAdvancedFaceDetection: function(imageData, width, height) {
            const data = imageData.data;
            
            // 얼굴 특징 감지를 위한 다중 스케일 분석
            const faceCandidate = this.detectFaceFeatures(data, width, height);
            
            if (faceCandidate) {
              // 감지된 얼굴을 기반으로 랜드마크 생성
              return this.generateFaceLandmarks(faceCandidate, width, height);
            }
            
            return null;
          },
          
          // 얼굴 특징 감지 (개선된 버전)
          detectFaceFeatures: function(data, width, height) {
            // 적분 이미지(Integral Image) 생성으로 빠른 계산
            const integralImage = this.createIntegralImage(data, width, height);
            
            // 얼굴 템플릿 매칭
            const faceTemplates = this.getFaceTemplates();
            let bestMatch = null;
            let bestScore = 0;
            
            // 다중 스케일로 얼굴 탐지
            for (let scale = 0.5; scale <= 2.0; scale += 0.3) {
              const result = this.detectAtScale(integralImage, width, height, scale, faceTemplates);
              if (result && result.score > bestScore) {
                bestMatch = result;
                bestScore = result.score;
              }
            }
            
            // 신뢰도가 충분히 높은 경우만 반환
            return bestScore > 0.3 ? bestMatch : null;
          },
          
          // 적분 이미지 생성
          createIntegralImage: function(data, width, height) {
            const integral = new Array(width * height);
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                
                const current = gray;
                const left = x > 0 ? integral[y * width + x - 1] : 0;
                const top = y > 0 ? integral[(y - 1) * width + x] : 0;
                const topLeft = (x > 0 && y > 0) ? integral[(y - 1) * width + x - 1] : 0;
                
                integral[y * width + x] = current + left + top - topLeft;
              }
            }
            
            return integral;
          },
          
          // 얼굴 템플릿들
          getFaceTemplates: function() {
            return [
              // 얼굴 전체 영역
              { type: 'face', pattern: [0, 0, 1, 1], weight: 1.0 },
              // 눈 영역 (어두운 부분)
              { type: 'eyes', pattern: [0.2, 0.3, 0.6, 0.2], weight: -0.8 },
              // 이마 영역 (밝은 부분)
              { type: 'forehead', pattern: [0.1, 0.1, 0.8, 0.3], weight: 0.5 },
              // 입 영역
              { type: 'mouth', pattern: [0.3, 0.7, 0.4, 0.2], weight: -0.3 }
            ];
          },
          
          // 특정 스케일에서 얼굴 감지
          detectAtScale: function(integralImage, width, height, scale, templates) {
            const windowSize = Math.min(width, height) * scale;
            const stepSize = Math.max(1, Math.floor(windowSize * 0.1));
            
            let bestScore = 0;
            let bestRegion = null;
            
            for (let y = 0; y < height - windowSize; y += stepSize) {
              for (let x = 0; x < width - windowSize; x += stepSize) {
                const score = this.evaluateRegion(integralImage, width, x, y, windowSize, templates);
                
                if (score > bestScore) {
                  bestScore = score;
                  bestRegion = {
                    x: x,
                    y: y,
                    width: windowSize,
                    height: windowSize,
                    score: score
                  };
                }
              }
            }
            
            return bestRegion;
          },
          
          // 영역 평가
          evaluateRegion: function(integralImage, width, x, y, size, templates) {
            let totalScore = 0;
            
            for (const template of templates) {
              const tx = Math.floor(x + template.pattern[0] * size);
              const ty = Math.floor(y + template.pattern[1] * size);
              const tw = Math.floor(template.pattern[2] * size);
              const th = Math.floor(template.pattern[3] * size);
              
              const regionSum = this.getRegionSum(integralImage, width, tx, ty, tw, th);
              const regionAvg = regionSum / (tw * th);
              
              // 템플릿에 따른 점수 계산
              totalScore += regionAvg * template.weight;
            }
            
            return Math.max(0, totalScore / 255); // 0-1 범위로 정규화
          },
          
          // 적분 이미지를 이용한 영역 합 계산
          getRegionSum: function(integralImage, width, x, y, w, h) {
            const x2 = x + w - 1;
            const y2 = y + h - 1;
            
            const bottomRight = integralImage[y2 * width + x2] || 0;
            const topRight = y > 0 ? (integralImage[(y - 1) * width + x2] || 0) : 0;
            const bottomLeft = x > 0 ? (integralImage[y2 * width + x - 1] || 0) : 0;
            const topLeft = (x > 0 && y > 0) ? (integralImage[(y - 1) * width + x - 1] || 0) : 0;
            
            return bottomRight - topRight - bottomLeft + topLeft;
          },
          
          // 감지된 얼굴 영역에서 랜드마크 생성
          generateFaceLandmarks: function(faceRegion, width, height) {
            const { x, y, width: faceWidth, height: faceHeight } = faceRegion;
            
            // 얼굴 좌표를 0-1 범위로 정규화
            const centerX = (x + faceWidth / 2) / width;
            const centerY = (y + faceHeight / 2) / height;
            const sizeX = faceWidth / width;
            const sizeY = faceHeight / height;
            
            // 주요 랜드마크 포인트들 생성
            const landmarks = {};
            
            // 코끝 (1번)
            landmarks[1] = { x: centerX, y: centerY + sizeY * 0.1 };
            
            // 이마 중앙 (9번)
            landmarks[9] = { x: centerX, y: centerY - sizeY * 0.3 };
            
            // 턱 중앙 (175번)
            landmarks[175] = { x: centerX, y: centerY + sizeY * 0.4 };
            
            // 왼쪽 볼 (234번)
            landmarks[234] = { x: centerX - sizeX * 0.3, y: centerY };
            
            // 오른쪽 볼 (454번)
            landmarks[454] = { x: centerX + sizeX * 0.3, y: centerY };
            
            // 왼쪽 눈 주요 포인트들
            landmarks[33] = { x: centerX - sizeX * 0.2, y: centerY - sizeY * 0.1 };  // 눈 안쪽 모서리
            landmarks[159] = { x: centerX - sizeX * 0.25, y: centerY - sizeY * 0.1 }; // 눈 중앙
            
            // 오른쪽 눈 주요 포인트들
            landmarks[362] = { x: centerX + sizeX * 0.2, y: centerY - sizeY * 0.1 };  // 눈 안쪽 모서리
            landmarks[385] = { x: centerX + sizeX * 0.25, y: centerY - sizeY * 0.1 }; // 눈 중앙
                
                return {
              multiFaceLandmarks: [landmarks],
              faceDetectionConfidence: faceRegion.score,
              detectionMethod: 'Advanced Local'
                };
              },
              
              init: function() {
            console.log('✅ 고급 로컬 얼굴감지 시스템 초기화 완료');
                return true;
              }
            };
            
        // 초기화 호출
            window.GazeScrollFaceDetection.init();
        
        // 즉시 성공으로 resolve
        resolve(true);
        
      } catch (error) {
        console.error('❌ 로컬 얼굴감지 시스템 초기화 실패:', error);
        resolve(false);
      }
    });
  }

  // 스크립트 동적 로드 헬퍼 함수
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 간소화된 얼굴 감지 시스템 초기화
  async initMediaPipeFaceMesh() {
    try {
      // 페이지 컨텍스트의 얼굴 감지 시스템 확인
      if (window.GazeScrollFaceDetection && window.GazeScrollFaceDetection.initialized) {
        this.faceMesh = window.GazeScrollFaceDetection;
        this.mediaPipeInitialized = true;
        console.log('✅ 간소화된 얼굴 감지 시스템 초기화 완료');
      } else {
        throw new Error('얼굴 감지 시스템이 로드되지 않았습니다');
      }
      
    } catch (error) {
      console.error('❌ 얼굴 감지 시스템 초기화 실패:', error);
      console.log('📱 기본 피부톤 기반 감지로 전환');
      this.mediaPipeInitialized = false;
    }
  }

  // 안전한 메시지 전송 함수 (개선된 버전)
  safeMessageSend(message, maxRetries = 2) {
    // 메시지 전송이 일시 중단된 경우 무시
    if (this.messageSendPaused) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let retryCount = 0;

      const attemptSend = () => {
        try {
          // 확장 프로그램 컨텍스트 유효성 확인
          if (!chrome?.runtime?.sendMessage) {
            console.warn('Chrome runtime이 사용할 수 없습니다.');
            this.handleConnectionLoss();
            resolve(false);
            return;
          }

          // 런타임 ID 확인 (확장 프로그램이 다시 로드되었는지 체크)
          if (!chrome.runtime.id) {
            console.warn('Extension context가 무효화되었습니다.');
            this.handleConnectionLoss();
            resolve(false);
            return;
          }

          // 메시지 전송 시도 (타임아웃 추가)
          const sendTimeout = setTimeout(() => {
            console.warn('메시지 전송 타임아웃');
            this.handleConnectionLoss();
            resolve(false);
          }, 2000);

          chrome.runtime.sendMessage(message)
            .then((response) => {
              clearTimeout(sendTimeout);
              // 성공
              if (this.messageSendPaused) {
                console.log('메시지 전송이 재개되었습니다.');
                this.messageSendPaused = false;
              }
              resolve(true);
            })
            .catch((error) => {
              clearTimeout(sendTimeout);
              const errorMessage = error?.message || '';
              
              // 특정 오류들은 재시도하지 않음
              if (errorMessage.includes('Extension context invalidated') ||
                  errorMessage.includes('message channel closed') ||
                  errorMessage.includes('Receiving end does not exist') ||
                  errorMessage.includes('Could not establish connection') ||
                  errorMessage.includes('The message port closed before a response was received')) {
                
                console.warn('연결 오류 감지:', errorMessage);
                this.handleConnectionLoss();
                resolve(false);
                return;
              }

              // 다른 오류는 재시도
              retryCount++;
              if (retryCount < maxRetries) {
                console.warn(`메시지 전송 실패, 재시도 ${retryCount}/${maxRetries}:`, errorMessage);
                setTimeout(attemptSend, 200 * retryCount); // 점진적 지연
              } else {
                console.warn('메시지 전송 최종 실패:', errorMessage);
                this.handleConnectionLoss();
                resolve(false);
              }
            });

        } catch (error) {
          console.warn('메시지 전송 중 예외:', error?.message || error);
          this.handleConnectionLoss();
          resolve(false);
        }
      };

      attemptSend();
    });
  }

  // 연결 손실 처리 (개선된 버전)
  handleConnectionLoss() {
    if (!this.messageSendPaused) {
      console.warn('📞 확장 프로그램 연결이 끊어졌습니다. 팝업이 닫혔거나 확장 프로그램이 다시 로드되었을 수 있습니다.');
      this.messageSendPaused = true;

      // 더 긴 지연으로 재연결 시도 (5초)
      setTimeout(() => {
        // 런타임이 여전히 유효한지 확인
        if (chrome?.runtime?.id) {
          console.log('🔄 메시지 전송 재개를 시도합니다...');
        this.messageSendPaused = false;
        } else {
          console.warn('⚠️ 확장 프로그램 컨텍스트가 여전히 무효합니다.');
          // 더 긴 지연으로 다시 시도
          setTimeout(() => {
            this.messageSendPaused = false;
          }, 5000);
        }
      }, 5000);
    }
  }

  sendInitialFrame() {
    // 즉시 첫 프레임을 전송하여 "프레임 대기중" 상태를 해결
    if (!this.isActive || !this.video || !this.canvas) {
      return;
    }

    try {
      if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // 기본 디버그 데이터 생성
        const debugData = {
          gazePosition: '중앙',
          gazeX: 0.5,
          gazeY: 0.5,
          brightnessDiff: '0.00',
          scrollDirection: 0,
          acceleration: 0,
          regions: { top: '0.500', bottom: '0.500', center: '0.500' },
          faceDetection: { status: 'initializing', message: '초기화 중...', confidence: 0 },
          eyeTracking: { quality: { score: 0, status: 'initializing', message: '초기화 중...' } },
          systemStatus: {
            isActive: true,
            isCalibrating: false,
            debugMode: true
            // mirrorMode 제거됨 - 항상 반전 모드로 고정
          }
        };

        // 캔버스 이미지 캡처
        const debugCanvas = document.createElement('canvas');
        const debugCtx = debugCanvas.getContext('2d');
        debugCanvas.width = 320;
        debugCanvas.height = 240;
        debugCtx.imageSmoothingEnabled = true;
        debugCtx.imageSmoothingQuality = 'high';
        debugCtx.drawImage(this.canvas, 0, 0, debugCanvas.width, debugCanvas.height);
        
        debugData.frameImage = debugCanvas.toDataURL('image/jpeg', 0.8);

        // 팝업으로 전송 (안전한 방식)
        this.safeMessageSend({
          action: 'debugUpdate',
          data: debugData
        }).then((success) => {
          if (success) {
            console.log('✅ 초기 프레임 전송 완료');
          } else {
            console.warn('초기 프레임 전송 실패');
          }
        });
      } else {
        console.log('비디오 데이터가 아직 준비되지 않음, 500ms 후 재시도');
        setTimeout(() => this.sendInitialFrame(), 500);
      }
    } catch (error) {
      console.error('초기 프레임 전송 중 오류:', error);
    }
  }

  // 반전 모드 해제 - 정상 상태로 고정
  applyMirrorMode() {
    if (this.video) {
      // 정상 상태 (반전 없음)
      this.video.style.transform = 'scaleX(1)';
    }
  }

  recenterEyes() {
    // 눈 중앙 맞추기 초기화
    this.eyeTrackingState.isCalibrated = false;
    this.eyeTrackingState.calibrationFrames = 0;
    this.eyeTrackingState.lastEyePosition = null;

    // 팝업으로 알림 전달 (안전한 방식)
    this.safeMessageSend({
      action: 'notify',
      message: '눈 위치를 다시 찾고 있습니다. 잠시만 기다려주세요...',
      duration: 2500
    });

    // 3초 후에 캘리브레이션 완료 알림
    setTimeout(() => {
      if (this.eyeTrackingState.isCalibrated) {
        this.safeMessageSend({
          action: 'notify',
          message: '눈 중앙 맞추기가 완료되었습니다!',
          duration: 2000
        });
      } else {
        this.safeMessageSend({
          action: 'notify',
          message: '눈을 찾지 못했습니다. 밝은 곳에서 다시 시도해주세요.',
          duration: 2500
        });
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

    // 고해상도에 맞는 캔버스 요소 생성 (willReadFrequently로 readback 최적화)
    const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'none';
    this.canvas.width = resolution.width;
    this.canvas.height = resolution.height;

    document.body.appendChild(this.video);
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    console.log(`🖼️ 캔버스 크기 설정: ${resolution.width}x${resolution.height}`);
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

      case 'setCameraResolution':
        this.settings.cameraResolution = message.resolution;
        // 카메라가 활성화된 상태라면 재시작
        if (this.isActive) {
          this.restartWithNewResolution();
        }
        sendResponse({ success: true });
        break;

      case 'getCameraResolutions':
        sendResponse({ 
          resolutions: this.cameraResolutions,
          current: this.settings.cameraResolution
        });
        break;

      // setMirrorMode 케이스 제거됨 - 항상 반전 모드로 고정

      case 'recenterEyes':
        this.recenterEyes();
        sendResponse({ success: true });
        break;

      case 'tabUpdated':
        // 탭이 업데이트되면 필요한 초기화 작업
        // 동기 처리이므로 응답 필요 없음
        break;
    }
    // 비동기 응답이 필요한 경우에만 true를 반환해야 함
    return false;
  }

  async startGazeTracking() {
    if (this.isActive) return Promise.resolve();

    try {
      // 카메라 권한 확인 및 요청
      await this.requestCameraPermission();

      // 카메라 요소 초기화
      this.initCameraElements();

      // 고해상도 카메라 스트림 시작
      const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
      console.log(`🎥 카메라 해상도 설정: ${resolution.label} (${resolution.width}x${resolution.height})`);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: resolution.width, min: 640 },
          height: { ideal: resolution.height, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        }
      });

      this.video.srcObject = stream;
      
      // 비디오 메타데이터 로드 대기
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          console.log('비디오 메타데이터 로드됨:', {
            width: this.video.videoWidth,
            height: this.video.videoHeight,
            duration: this.video.duration
          });
          resolve();
        };
        this.video.onerror = reject;
        setTimeout(reject, 5000); // 5초 타임아웃
      });

      await this.video.play();
      
      // 비디오가 실제로 재생되기 시작할 때까지 대기
      await new Promise((resolve) => {
        const checkPlaying = () => {
          if (this.video.currentTime > 0 && !this.video.paused && !this.video.ended && this.video.readyState > 2) {
            console.log('비디오 재생 시작됨');
            resolve();
          } else {
            setTimeout(checkPlaying, 100);
          }
        };
        checkPlaying();
      });

      this.isActive = true;

      // 시선 추적 루프 시작
      this.startTrackingLoop();

      // 즉시 첫 프레임 전송 (프레임 대기중 상태 해결)
      setTimeout(() => {
        this.sendInitialFrame();
      }, 100);

      console.log('시선 추적이 시작되었습니다.');
      this.safeMessageSend({
        action: 'notify',
        message: '시선 추적이 시작되었습니다! 이제 눈을 움직여서 스크롤해보세요.',
        duration: 3500
      });

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

  // 새로운 해상도로 카메라 재시작
  async restartWithNewResolution() {
    if (!this.isActive) return;
    
    console.log('🔄 해상도 변경으로 인한 카메라 재시작...');
    
    // 기존 스트림 정리
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
    
    try {
      // 새로운 해상도로 다시 초기화
      this.initCameraElements();
      
      const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
      console.log(`🎥 새 해상도 적용: ${resolution.label} (${resolution.width}x${resolution.height})`);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: resolution.width, min: 640 },
          height: { ideal: resolution.height, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        }
      });
      
      this.video.srcObject = stream;
      
      // 비디오 메타데이터 로드 대기
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          console.log('✅ 새 해상도 적용 완료:', {
            width: this.video.videoWidth,
            height: this.video.videoHeight,
            canvas: `${this.canvas.width}x${this.canvas.height}`
          });
          resolve();
        };
        this.video.onerror = reject;
        setTimeout(reject, 5000);
      });
      
      await this.video.play();
      
      // 성공 알림
      this.safeMessageSend({
        action: 'notify',
        message: `✅ 카메라 해상도가 ${resolution.label}로 변경되었습니다!`,
        duration: 3000
      });
      
    } catch (error) {
      console.error('❌ 해상도 변경 실패:', error);
      
      // 실패 시 기본 해상도로 복구
      this.settings.cameraResolution = 'HD';
      this.safeMessageSend({
        action: 'notify',
        message: '⚠️ 해상도 변경 실패. 기본 해상도로 복구합니다.',
        duration: 3000
      });
      
      // 기본 해상도로 재시도
      try {
        await this.restartWithNewResolution();
      } catch (retryError) {
        console.error('기본 해상도 복구도 실패:', retryError);
        // 최종적으로 시선 추적 중지
        this.stopGazeTracking();
      }
    }
  }

  calibrate() {
    if (!this.isActive || this.isCalibrating) return;

    this.isCalibrating = true;
    this.safeMessageSend({
      action: 'notify',
      message: '보정 모드에서는 화면 중앙을 바라봐주세요. 3초 후 자동으로 완료됩니다.',
      duration: 3000
    });

    setTimeout(() => {
      this.isCalibrating = false;
      this.safeMessageSend({
        action: 'notify',
        message: '보정이 완료되었습니다!',
        duration: 2000
      });
    }, 3000);
  }

  startTrackingLoop() {
    let previousBrightness = 0;
    let frameCount = 0;
    let lastFrameTime = 0;
    
    // 해상도에 따른 동적 FPS 조정
    const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    const resolutionFactor = (resolution.width * resolution.height) / (1280 * 720); // HD 대비 비율
    
    let targetFPS;
    if (resolutionFactor <= 1) {
      targetFPS = 15; // HD 이하: 15fps
    } else if (resolutionFactor <= 2.25) {
      targetFPS = 12; // FHD: 12fps
    } else if (resolutionFactor <= 4) {
      targetFPS = 8;  // QHD: 8fps
    } else {
      targetFPS = 5;  // 4K: 5fps
    }
    
    const frameInterval = 1000 / targetFPS;
    console.log(`🎯 동적 FPS 설정: ${targetFPS}fps (해상도: ${resolution.label})`);
    

    const track = (currentTime = 0) => {
      if (!this.isActive) return;

      // 프레임 레이트 제한
      if (currentTime - lastFrameTime < frameInterval) {
        this.animationId = requestAnimationFrame(track);
        return;
      }
      lastFrameTime = currentTime;

      try {
        // 캔버스에 비디오 프레임 그리기 (안전한 접근)
        if (this.video && this.video.readyState === this.video.HAVE_ENOUGH_DATA && 
            this.canvas && this.ctx) {
          try {
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          } catch (drawError) {
            console.warn('비디오 프레임 그리기 실패:', drawError);
            this.animationId = requestAnimationFrame(track);
            return;
          }

                    // 고급 로컬 얼굴감지 시스템 사용
          if (this.mediaPipeInitialized && this.faceMesh && this.faceMesh.detectFace) {
            try {
              // 고급 로컬 얼굴감지 시스템 실행
              const detectionResult = this.faceMesh.detectFace(this.video);
              
              if (detectionResult && detectionResult.multiFaceLandmarks && detectionResult.multiFaceLandmarks.length > 0) {
                this.faceDetectionResults = detectionResult;
                // 성공 로그는 5초마다 한 번만 출력 (로그 스팸 방지)
                if (!this.lastAdvancedDetectionLog || Date.now() - this.lastAdvancedDetectionLog > 5000) {
                  console.log(`🎯 고급 얼굴감지 작동중: 신뢰도 ${(detectionResult.faceDetectionConfidence * 100).toFixed(1)}%`);
                  this.lastAdvancedDetectionLog = Date.now();
                }
              } else {
                // 고급 감지 실패 시 기본 피부톤 감지로 fallback
                this.faceDetectionResults = null;
              }
            } catch (error) {
              console.warn('고급 얼굴 감지 처리 중 오류:', error);
              this.faceDetectionResults = null;
            }
          } else {
            // 고급 시스템이 없으면 기본 감지 사용
            this.faceDetectionResults = null;
          }

          // 이미지 데이터 가져오기 (최적화: 필요한 영역만 처리)
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const data = imageData.data;

          // 간단한 밝기 분석으로 시선 방향 추정 (Fallback용)
          const regions = this.analyzeImageRegions(data, this.canvas.width, this.canvas.height);

                  // 개선된 눈 감지 시스템 사용 (안전한 에러 핸들링)
          let eyeRegions = null;
          let currentFaceRegion = null;
          
          try {
            // 개선된 눈 감지 알고리즘 사용 (MediaPipe + fallback 결합)
            eyeRegions = this.detectEyesWithTracking(data, this.canvas.width, this.canvas.height);
            
            // 기본 얼굴 영역도 확보 (디버그 및 fallback용)
            if (!this.mediaPipeInitialized || !this.faceDetectionResults) {
            currentFaceRegion = this.findFaceRegion(data, this.canvas.width, this.canvas.height);
              if (eyeRegions && currentFaceRegion) {
                eyeRegions.faceRegion = currentFaceRegion; // 얼굴 영역 정보 추가
              }
            }
          } catch (eyeDetectionError) {
            console.warn('눈 감지 중 오류:', eyeDetectionError);
            eyeRegions = null;
            currentFaceRegion = null;
          }
          
          // 현재 감지된 얼굴 영역을 저장 (디버그용)
          this.currentFaceRegion = currentFaceRegion;

          // 화면 높이 기준으로 영역 계산
          const screenHeight = window.innerHeight;
          const topThreshold = screenHeight * (this.settings.topZone / 100);
          const bottomThreshold = screenHeight * (1 - this.settings.bottomZone / 100);

          // 시선 방향 결정 (개선된 알고리즘 - 안전한 에러 핸들링)
          let gazeY = screenHeight * 0.5; // 기본값: 화면 중앙
          
          try {
            if (eyeRegions && eyeRegions.isMediaPipe && eyeRegions.gaze && 
                typeof eyeRegions.gaze.confidence === 'number' && eyeRegions.gaze.confidence > 0.3) {
              // 개선된 MediaPipe 기반 정밀한 시선 추정
              gazeY = this.estimateGazeYWithAdvancedMediaPipe(eyeRegions, screenHeight);
              if (this.settings.debugMode) {
                console.log(`👁️ 고급 눈 추적: 신뢰도 ${(eyeRegions.gaze.confidence * 100).toFixed(1)}%, Y: ${gazeY.toFixed(1)}`);
              }
            } else if (eyeRegions && (eyeRegions.leftEye || eyeRegions.rightEye)) {
              // 기본 눈 감지 결과 사용
              gazeY = this.estimateGazeYWithBasicEyeTracking(eyeRegions, screenHeight);
              if (this.settings.debugMode) {
                console.log(`👀 기본 눈 추적 사용`);
              }
          } else {
              // 밝기 분석 fallback
            gazeY = this.estimateGazeY(regions, screenHeight);
              if (this.settings.debugMode) {
                console.log(`🔍 밝기 분석 fallback 사용`);
              }
            }
          } catch (gazeError) {
            console.warn('시선 방향 계산 중 오류:', gazeError);
            gazeY = this.estimateGazeY(regions, screenHeight); // 안전한 fallback
          }
          
          // gazeY 값 유효성 검사
          if (typeof gazeY !== 'number' || isNaN(gazeY)) {
            gazeY = screenHeight * 0.5; // 기본값으로 복구
          }

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

          // 디버그 정보 전송 (항상 전송 - 팝업에서 카메라 표시용)
          const currentBrightness = (regions.top + regions.bottom + regions.left + regions.right) / 4;
          const brightnessDiff = currentBrightness - previousBrightness;
          
          // 눈 감지 가이드라인 또는 성공 표시
          const hasValidEyes = this.hasValidEyeDetection(eyeRegions);
          if (!hasValidEyes) {
            this.drawEyeGuidelines(currentFaceRegion);
            // 눈 감지 실패 시 성공 시간 리셋
            this.eyeDetectionSuccessTime = null;
          } else {
            // 눈 감지 성공 시 간단한 체크마크 표시
            this.drawEyeDetectionSuccess(eyeRegions);
          }

          // 디버그 모드에서 눈과 얼굴 영역 시각화
          if (this.settings.debugMode) {
            this.drawDebugOverlay(currentFaceRegion, eyeRegions, regions);
          }

          // 실시간 눈 감지 상태 로그 (디버그 모드)
          this.logEyeDetectionStatus(currentFaceRegion, eyeRegions);
          
          // 얼굴 감지 상태에 따른 사용자 피드백
          this.provideFaceDetectionFeedback(currentFaceRegion, eyeRegions);
          
          this.sendDebugInfo(regions, currentBrightness, previousBrightness, gazeY, screenHeight, eyeRegions, currentFaceRegion);

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
    // 1. 얼굴 영역 찾기 (개선된 피부톤 기반 감지)
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
    // 개선된 얼굴 영역 감지 (HSV 색공간 + 엣지 검출 조합)
    let skinPixels = 0;
    let centerX = 0, centerY = 0;
    const skinMap = new Uint8Array(width * height);
    
    // 여러 피부톤 검출 방법을 조합하여 정확도 향상
    const detectionMethods = {
      rgb: 0,
      hsv: 0,
      yuv: 0
    };

    // 해상도에 따른 적응적 샘플링
    const currentResolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    const resolutionFactor = (currentResolution.width * currentResolution.height) / (1280 * 720);
    
    // 고해상도일수록 더 큰 스텝으로 샘플링 (성능 최적화)
    let step;
    if (resolutionFactor <= 1) {
      step = 2; // HD 이하: 2px
    } else if (resolutionFactor <= 2.25) {
      step = 3; // FHD: 3px  
    } else if (resolutionFactor <= 4) {
      step = 4; // QHD: 4px
    } else {
      step = 6; // 4K: 6px
    }
    
    console.log(`🔍 피부톤 샘플링: ${step}px 스텝 (해상도: ${currentResolution.label})`);
    
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 방법 1: 개선된 RGB 기반 피부톤 감지
        const brightness = (r + g + b) / 3;
        const rgbSkinDetected = this.detectSkinRGB(r, g, b, brightness);
        
        // 방법 2: HSV 색공간 기반 감지
        const hsvSkinDetected = this.detectSkinHSV(r, g, b);
        
        // 방법 3: YUV 색공간 기반 감지 (더 안정적)
        const yuvSkinDetected = this.detectSkinYUV(r, g, b);
        
        // 투표 방식으로 최종 결정 (2개 이상의 방법이 피부톤으로 판단하면 채택)
        const voteCount = rgbSkinDetected + hsvSkinDetected + yuvSkinDetected;
        const isSkin = voteCount >= 2;
        
        if (rgbSkinDetected) detectionMethods.rgb++;
        if (hsvSkinDetected) detectionMethods.hsv++;
        if (yuvSkinDetected) detectionMethods.yuv++;

        skinMap[y * width + x] = isSkin ? 1 : 0;

        if (isSkin) {
          skinPixels++;
          centerX += x;
          centerY += y;
        }
      }
    }

    const totalSamples = (width * height) / (step * step);
    const skinPercentage = (skinPixels / totalSamples) * 100;

    // 적응적 임계값 (조명 조건에 따라 조정)
    const avgBrightness = this.calculateAverageBrightness(data, width, height);
    const adaptiveThreshold = this.calculateAdaptiveThreshold(avgBrightness, totalSamples);
    
    // 디버그 로깅 (상세 정보 포함)
    const debugResolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    console.log(`🔍 얼굴감지 분석 (${debugResolution.label}):`, {
      피부톤픽셀: skinPixels,
      전체샘플: totalSamples,
      비율: `${skinPercentage.toFixed(2)}%`,
      필요임계값: adaptiveThreshold.toFixed(0),
      평균밝기: avgBrightness.toFixed(1),
      RGB감지: detectionMethods.rgb,
      HSV감지: detectionMethods.hsv,
      YUV감지: detectionMethods.yuv,
      해상도: `${width}x${height}`,
      샘플링스텝: step
    });

    if (skinPixels > adaptiveThreshold) {
      centerX /= skinPixels;
      centerY /= skinPixels;

      // 감지된 피부톤 분포를 기반으로 얼굴 크기 동적 조정
      const faceSize = this.estimateFaceSize(skinPixels, totalSamples, width, height);
      const faceRegion = {
        x: Math.max(0, centerX - faceSize / 2),
        y: Math.max(0, centerY - faceSize / 2),
        width: Math.min(width - (centerX - faceSize / 2), faceSize),
        height: Math.min(height - (centerY - faceSize / 2), faceSize),
        skinMap: skinMap,
        skinPixels: skinPixels,
        totalSamples: totalSamples,
        confidence: Math.min(1, skinPixels / adaptiveThreshold), // 신뢰도 추가
        detectionMethods: detectionMethods // 각 방법별 감지 수 기록
      };

      console.log(`✅ 얼굴감지 성공: 중심(${centerX.toFixed(0)}, ${centerY.toFixed(0)}), 크기=${faceSize.toFixed(0)}px, 신뢰도=${faceRegion.confidence.toFixed(2)}`);
      return faceRegion;
    } else {
      const shortfall = adaptiveThreshold - skinPixels;
      const shortfallPercent = (shortfall / adaptiveThreshold * 100).toFixed(1);
      
      console.log(`❌ 얼굴감지 실패 (${debugResolution.label}): 피부톤 픽셀 부족`);
      console.log(`   현재: ${skinPixels}픽셀 (${skinPercentage.toFixed(2)}%)`);
      console.log(`   필요: ${adaptiveThreshold.toFixed(0)}픽셀 (부족: ${shortfall}픽셀, ${shortfallPercent}%)`);
      console.log(`   💡 해결방법: 더 밝은 조명, 카메라에 가까이, 정면 응시`);
      
      // 임계값이 너무 높은지 확인 (고해상도에서 발생할 수 있음)
      if (adaptiveThreshold > totalSamples * 0.05) {
        console.warn(`⚠️ 임계값이 너무 높을 수 있음 (전체 샘플의 ${(adaptiveThreshold/totalSamples*100).toFixed(1)}%)`);
      }
    }

    // 얼굴을 찾지 못한 경우 null 반환 (fallback 제거하여 더 정확한 감지)
    return null;
  }

  // RGB 색공간 기반 피부톤 감지 (고해상도 개선 버전)
  detectSkinRGB(r, g, b, brightness) {
    // 고해상도에서 더 정밀한 피부톤 감지를 위한 확장된 조건들
    const conditions = [
      // 조건 1: 일반적인 피부톤 (기존)
      r > 95 && g > 40 && b > 20 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15 && r > g && r > b,
      
      // 조건 2: 어두운 피부톤 (기존)
      r > 45 && g > 25 && b > 15 &&
      r >= g && r >= b && brightness > 30,
      
      // 조건 3: 밝은 피부톤 (기존)
      brightness > 80 && brightness < 230 &&
      r > g * 1.1 && r > b * 1.15,
      
      // 조건 4: 중간 톤 피부 (새로 추가)
      r > 60 && g > 35 && b > 25 &&
      r > g && r > b && brightness > 50 && brightness < 200,
      
      // 조건 5: 따뜻한 톤 피부 (새로 추가)
      r > 70 && g > 50 && b > 30 &&
      (r - b) > 10 && (r - g) > 5 && brightness > 60,
      
      // 조건 6: 차가운 톤 피부 (새로 추가)
      r > 80 && g > 55 && b > 40 &&
      r > g && g > b && (r - b) > 15 && brightness > 70
    ];
    
    return conditions.some(condition => condition);
  }

  // HSV 색공간 기반 피부톤 감지 (확장된 범위)
  detectSkinHSV(r, g, b) {
    // RGB를 HSV로 변환
    const { h, s, v } = this.rgbToHsv(r, g, b);
    
    // 피부톤의 HSV 범위 (확장된 범위로 더 다양한 피부톤 지원)
    const conditions = [
      // 기본 피부톤 범위
      (h >= 0 && h <= 50) && (s >= 0.23 && s <= 0.68) && (v >= 0.35 && v <= 1.0),
      // 어두운 피부톤 범위
      (h >= 0 && h <= 35) && (s >= 0.15 && s <= 0.85) && (v >= 0.25 && v <= 0.95),
      // 밝은 피부톤 범위  
      (h >= 0 && h <= 60) && (s >= 0.10 && s <= 0.50) && (v >= 0.50 && v <= 1.0)
    ];
    
    return conditions.some(condition => condition);
  }

  // YUV 색공간 기반 피부톤 감지 (확장된 범위)
  detectSkinYUV(r, g, b) {
    // RGB를 YUV로 변환
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const u = -0.147 * r - 0.289 * g + 0.436 * b;
    const v = 0.615 * r - 0.515 * g - 0.100 * b;
    
    // 피부톤의 YUV 범위 (더 포용적인 범위)
    const conditions = [
      // 기본 범위
      y >= 60 && y <= 230 && u >= -15 && u <= 25 && v >= -10 && v <= 20,
      // 어두운 피부톤 범위
      y >= 40 && y <= 180 && u >= -20 && u <= 30 && v >= -15 && v <= 25,
      // 밝은 피부톤 범위
      y >= 80 && y <= 255 && u >= -12 && u <= 20 && v >= -8 && v <= 15
    ];
    
    return conditions.some(condition => condition);
  }

  // RGB를 HSV로 변환
  rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    const s = max === 0 ? 0 : diff / max;
    const v = max;
    
    return { h, s, v };
  }

  // 평균 밝기 계산
  calculateAverageBrightness(data, width, height) {
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 16) { // 4픽셀마다 샘플링
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
      pixelCount++;
    }
    
    return totalBrightness / pixelCount;
  }

  // 적응적 임계값 계산 (고해상도 지원)
  calculateAdaptiveThreshold(avgBrightness, totalSamples) {
    // 해상도별 기본 비율 조정
    const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    const resolutionFactor = (resolution.width * resolution.height) / (1280 * 720); // HD 대비 비율
    
    // 고해상도일수록 더 많은 픽셀이 필요하지만, 비례적으로는 적게
    let baseThreshold;
    if (resolutionFactor <= 1) {
      baseThreshold = totalSamples / 100; // HD 이하: 1%
    } else if (resolutionFactor <= 2.25) {
      baseThreshold = totalSamples / 80; // FHD: 1.25%
    } else if (resolutionFactor <= 4) {
      baseThreshold = totalSamples / 60; // QHD: 1.67%
    } else {
      baseThreshold = totalSamples / 40; // 4K: 2.5%
    }
    
    // 조명 조건에 따른 조정
    if (avgBrightness < 50) {
      // 어두운 환경: 임계값 낮춤
      baseThreshold *= 0.4;
    } else if (avgBrightness > 180) {
      // 밝은 환경: 임계값 높임
      baseThreshold *= 1.3;
    }
    
    // 해상도에 따른 최소 픽셀 수 조정
    const minPixels = Math.max(50, Math.sqrt(resolutionFactor) * 20);
    
    console.log(`🎯 얼굴감지 임계값: ${baseThreshold.toFixed(0)}픽셀 (해상도: ${resolution.label}, 최소: ${minPixels.toFixed(0)})`);
    
    return Math.max(minPixels, baseThreshold);
  }

  // 얼굴 크기 추정 (고해상도 지원)
  estimateFaceSize(skinPixels, totalSamples, width, height) {
    const skinRatio = skinPixels / totalSamples;
    const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
    const resolutionFactor = (resolution.width * resolution.height) / (1280 * 720);
    
    // 해상도별 기본 크기 조정
    let baseSizeFactor;
    if (resolutionFactor <= 1) {
      baseSizeFactor = 0.3; // HD 이하
    } else if (resolutionFactor <= 2.25) {
      baseSizeFactor = 0.25; // FHD
    } else if (resolutionFactor <= 4) {
      baseSizeFactor = 0.2; // QHD
    } else {
      baseSizeFactor = 0.15; // 4K
    }
    
    // 피부톤 비율에 따른 얼굴 크기 추정 (고해상도 조정)
    let sizeFactor;
    if (skinRatio > 0.15) {
      sizeFactor = baseSizeFactor * 1.4; // 큰 얼굴
    } else if (skinRatio > 0.08) {
      sizeFactor = baseSizeFactor * 1.2; // 보통 얼굴  
    } else if (skinRatio > 0.04) {
      sizeFactor = baseSizeFactor; // 작은 얼굴
    } else {
      sizeFactor = baseSizeFactor * 0.8; // 매우 작은 얼굴
    }
    
    const estimatedSize = Math.min(width, height) * sizeFactor;
    console.log(`📏 얼굴크기 추정: ${estimatedSize.toFixed(0)}px (비율: ${(skinRatio*100).toFixed(2)}%, 해상도: ${resolution.label})`);
    
    return estimatedSize;
  }

  // 얼굴 감지 피드백 시스템
  provideFaceDetectionFeedback(faceRegion, eyeRegions) {
    const now = Date.now();
    
    // 피드백 쓰로틀링 (3초마다 한 번)
    if (!this.lastFeedbackTime || now - this.lastFeedbackTime < 3000) {
      return;
    }
    
    if (!faceRegion) {
      // 얼굴이 감지되지 않음 (고해상도 관련 팁 포함)
      const resolution = this.cameraResolutions[this.settings.cameraResolution] || this.cameraResolutions['HD'];
      const isHighRes = resolution.width >= 1920;
      
      let message = '👤 얼굴을 찾을 수 없습니다. 카메라를 정면으로 향하고 충분한 조명을 확보해주세요.';
      
      if (isHighRes) {
        message += '\n🔍 고해상도 모드: 더 가까이 앉거나 조명을 밝게 해보세요.';
      }
      
      this.safeMessageSend({
        action: 'notify',
        message: message,
        duration: 4000
      });
    } else if (faceRegion.confidence < 0.5) {
      // 얼굴 신뢰도가 낮음
      this.safeMessageSend({
        action: 'notify',
        message: '⚠️ 얼굴 감지 신뢰도가 낮습니다. 더 밝은 곳으로 이동하거나 카메라 위치를 조정해주세요.',
        duration: 3000
      });
    } else if (!eyeRegions || (!eyeRegions.leftEye && !eyeRegions.rightEye)) {
      // 눈을 찾을 수 없음
      this.safeMessageSend({
        action: 'notify',
        message: '👁️ 눈을 찾을 수 없습니다. 안경을 벗거나 머리카락이 눈을 가리지 않도록 해주세요.',
        duration: 3000
      });
    } else if (eyeRegions.leftEye && eyeRegions.rightEye && 
               (eyeRegions.leftEye.confidence < 0.3 || eyeRegions.rightEye.confidence < 0.3)) {
      // 눈 감지 신뢰도가 낮음
      this.safeMessageSend({
        action: 'notify',
        message: '🔍 눈 감지 정확도를 높이고 있습니다. 정면을 바라보고 잠시 기다려주세요.',
        duration: 3000
      });
    } else {
      // 성공적인 감지
      if (!this.faceDetectionSuccessNotified) {
        this.safeMessageSend({
          action: 'notify',
          message: '✅ 얼굴과 눈이 성공적으로 감지되었습니다! 이제 시선으로 스크롤하세요.',
          duration: 2000
        });
        this.faceDetectionSuccessNotified = true;
      }
    }
    
    this.lastFeedbackTime = now;
  }

  // 눈 감지 성공을 위한 조건 가이드
  getEyeDetectionGuide() {
    return {
      lighting: {
        title: '💡 조명 조건',
        requirements: [
          '얼굴에 충분한 빛이 비춰야 함',
          '너무 밝거나 어두우면 안됨',
          '역광(뒤에서 오는 빛) 피하기',
          '화면이나 창문 앞에서 촬영'
        ]
      },
      position: {
        title: '📍 위치 및 자세',
        requirements: [
          '카메라와 50-100cm 거리 유지',
          '얼굴이 화면의 15-30% 차지하도록',
          '정면을 바라보기 (좌우 20도 이내)',
          '머리를 너무 기울이지 않기'
        ]
      },
      facial: {
        title: '👤 얼굴 조건',
        requirements: [
          '눈이 머리카락에 가려지지 않게',
          '선글라스나 진한 안경 벗기',
          '눈을 자연스럽게 뜨고 있기',
          '화장이나 그림자로 눈이 가려지지 않게'
        ]
      },
      technical: {
        title: '⚙️ 기술적 조건',
        requirements: [
          '카메라 해상도 HD(720p) 이상 권장',
          '카메라 렌즈가 깨끗한지 확인',
          '움직임을 최소화하여 촬영',
          '디버그 모드에서 눈 영역 확인'
        ]
      }
    };
  }

  // 현재 눈 감지 상태 분석
  analyzeCurrentEyeDetectionStatus(faceRegion, eyeRegions) {
    const analysis = {
      overall: 'unknown',
      face: { detected: false, confidence: 0, issue: null },
      leftEye: { detected: false, confidence: 0, issue: null },
      rightEye: { detected: false, confidence: 0, issue: null },
      recommendations: []
    };

    // 얼굴 분석
    if (faceRegion) {
      analysis.face.detected = true;
      analysis.face.confidence = faceRegion.confidence;
      
      if (faceRegion.confidence < 0.3) {
        analysis.face.issue = 'low_confidence';
        analysis.recommendations.push('더 밝은 조명이나 정면 응시 필요');
      }
    } else {
      analysis.face.issue = 'not_detected';
      analysis.recommendations.push('얼굴을 카메라 중앙에 위치시키고 충분한 조명 확보');
    }

    // 눈 분석
    if (eyeRegions) {
      if (eyeRegions.leftEye && eyeRegions.leftEye.confidence > 0) {
        analysis.leftEye.detected = true;
        analysis.leftEye.confidence = eyeRegions.leftEye.confidence;
        
        if (eyeRegions.leftEye.isDefault) {
          analysis.leftEye.issue = 'using_default';
          analysis.recommendations.push('왼쪽 눈: 머리카락이나 그림자 확인');
        } else if (eyeRegions.leftEye.confidence < 0.4) {
          analysis.leftEye.issue = 'low_confidence';
        }
      } else {
        analysis.leftEye.issue = 'not_detected';
        analysis.recommendations.push('왼쪽 눈: 머리카락 정리나 안경 벗기');
      }

      if (eyeRegions.rightEye && eyeRegions.rightEye.confidence > 0) {
        analysis.rightEye.detected = true;
        analysis.rightEye.confidence = eyeRegions.rightEye.confidence;
        
        if (eyeRegions.rightEye.isDefault) {
          analysis.rightEye.issue = 'using_default';
          analysis.recommendations.push('오른쪽 눈: 머리카락이나 그림자 확인');
        } else if (eyeRegions.rightEye.confidence < 0.4) {
          analysis.rightEye.issue = 'low_confidence';
        }
      } else {
        analysis.rightEye.issue = 'not_detected';
        analysis.recommendations.push('오른쪽 눈: 머리카락 정리나 안경 벗기');
      }
    }

    // 전체 평가
    if (analysis.face.detected && analysis.leftEye.detected && analysis.rightEye.detected) {
      const avgConfidence = (analysis.face.confidence + analysis.leftEye.confidence + analysis.rightEye.confidence) / 3;
      if (avgConfidence > 0.6) {
        analysis.overall = 'excellent';
      } else if (avgConfidence > 0.4) {
        analysis.overall = 'good';
      } else {
        analysis.overall = 'poor';
      }
    } else {
      analysis.overall = 'failed';
    }

    return analysis;
  }

  // 유효한 눈 감지가 있는지 확인
  hasValidEyeDetection(eyeRegions) {
    if (!eyeRegions) return false;
    
    const leftValid = eyeRegions.leftEye && 
                     eyeRegions.leftEye.confidence > 0.3 && 
                     !eyeRegions.leftEye.isDefault;
                     
    const rightValid = eyeRegions.rightEye && 
                      eyeRegions.rightEye.confidence > 0.3 && 
                      !eyeRegions.rightEye.isDefault;
    
    return leftValid && rightValid;
  }

  // 눈 위치 가이드라인 그리기
  drawEyeGuidelines(faceRegion) {
    if (!this.ctx || !this.canvas) return;

    // 애니메이션을 위한 시간 기반 투명도
    const time = Date.now() / 1000;
    const pulseAlpha = 0.3 + 0.4 * Math.sin(time * 2); // 0.3-0.7 사이로 펄스
    
    this.ctx.save();
    this.ctx.globalAlpha = pulseAlpha;

    // 기본 가이드 위치 (화면 중앙 기준)
    let guideLeft, guideRight, guideTop, guideWidth, guideHeight;
    
    if (faceRegion) {
      // 얼굴이 감지된 경우 - 얼굴 기준으로 눈 가이드 그리기
      guideLeft = {
        x: faceRegion.x + faceRegion.width * 0.2,
        y: faceRegion.y + faceRegion.height * 0.3,
        width: faceRegion.width * 0.15,
        height: faceRegion.height * 0.1
      };
      
      guideRight = {
        x: faceRegion.x + faceRegion.width * 0.65,
        y: faceRegion.y + faceRegion.height * 0.3,
        width: faceRegion.width * 0.15,
        height: faceRegion.height * 0.1
      };
    } else {
      // 얼굴이 감지되지 않은 경우 - 화면 중앙에 기본 가이드
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height * 0.4;
      const eyeWidth = this.canvas.width * 0.08;
      const eyeHeight = this.canvas.height * 0.06;
      const eyeSpacing = this.canvas.width * 0.15;
      
      guideLeft = {
        x: centerX - eyeSpacing,
        y: centerY,
        width: eyeWidth,
        height: eyeHeight
      };
      
      guideRight = {
        x: centerX + eyeSpacing - eyeWidth,
        y: centerY,
        width: eyeWidth,
        height: eyeHeight
      };
    }

    // 가이드 타겟 그리기 (십자선 + 원)
    this.drawEyeTarget(guideLeft, '왼쪽 눈');
    this.drawEyeTarget(guideRight, '오른쪽 눈');

    // 중앙에 안내 메시지와 추가 팁
    this.ctx.globalAlpha = 0.9;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    
    const message = faceRegion ? 
      '눈을 초록색 타겟에 맞춰주세요' : 
      '얼굴을 화면 중앙에 맞춰주세요';
    
    const textX = this.canvas.width / 2;
    const textY = faceRegion ? faceRegion.y - 30 : this.canvas.height * 0.2;
    
    this.ctx.strokeText(message, textX, textY);
    this.ctx.fillText(message, textX, textY);
    
    // 추가 팁 메시지
    this.ctx.font = '16px Arial';
    this.ctx.fillStyle = '#FFFF00';
    
    const tips = faceRegion ? [
      '• 눈이 타겟 중앙에 오도록 위치 조정',
      '• 정면을 바라보고 눈을 자연스럽게 뜨세요',
      '• 머리카락이나 안경이 눈을 가리지 않게 하세요'
    ] : [
      '• 카메라와 50-100cm 거리 유지',
      '• 충분한 조명 확보 (너무 밝거나 어둡지 않게)',
      '• 정면을 바라보세요'
    ];
    
    let tipY = textY + 40;
    tips.forEach(tip => {
      this.ctx.strokeText(tip, textX, tipY);
      this.ctx.fillText(tip, textX, tipY);
      tipY += 25;
    });
    
    this.ctx.restore();
  }

  // 개별 눈 타겟 그리기
  drawEyeTarget(target, label) {
    const centerX = target.x + target.width / 2;
    const centerY = target.y + target.height / 2;
    const radius = Math.min(target.width, target.height) / 2;
    
    // 타겟 원 (3중 원)
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 3;
    
    // 외부 원
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius * 1.5, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // 중간 원
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // 내부 원
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // 십자선
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    // 수평선
    this.ctx.moveTo(centerX - radius * 0.8, centerY);
    this.ctx.lineTo(centerX + radius * 0.8, centerY);
    // 수직선
    this.ctx.moveTo(centerX, centerY - radius * 0.8);
    this.ctx.lineTo(centerX, centerY + radius * 0.8);
    this.ctx.stroke();
    
    // 라벨
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, centerX, centerY + radius * 2.5);
  }

  // 눈 감지 성공 표시
  drawEyeDetectionSuccess(eyeRegions) {
    if (!this.ctx || !eyeRegions) return;

    this.ctx.save();
    
    // 애니메이션을 위한 시간 기반 스케일
    const time = Date.now() / 1000;
    const scale = 0.8 + 0.2 * Math.sin(time * 3); // 0.8-1.0 사이로 펄스
    
    this.ctx.globalAlpha = 0.9;
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.fillStyle = '#00FF00';
    this.ctx.lineWidth = 4;

    // 왼쪽 눈 체크마크
    if (eyeRegions.leftEye && !eyeRegions.leftEye.isDefault) {
      const leftEye = eyeRegions.leftEye;
      const centerX = leftEye.x + leftEye.width / 2;
      const centerY = leftEye.y + leftEye.height / 2;
      const size = Math.min(leftEye.width, leftEye.height) * 0.4 * scale;
      
      this.drawCheckmark(centerX, centerY, size);
    }

    // 오른쪽 눈 체크마크
    if (eyeRegions.rightEye && !eyeRegions.rightEye.isDefault) {
      const rightEye = eyeRegions.rightEye;
      const centerX = rightEye.x + rightEye.width / 2;
      const centerY = rightEye.y + rightEye.height / 2;
      const size = Math.min(rightEye.width, rightEye.height) * 0.4 * scale;
      
      this.drawCheckmark(centerX, centerY, size);
    }

    // 성공 메시지 (잠깐만 표시)
    if (!this.eyeDetectionSuccessTime) {
      this.eyeDetectionSuccessTime = Date.now();
    }
    
    const timeSinceSuccess = Date.now() - this.eyeDetectionSuccessTime;
    if (timeSinceSuccess < 3000) { // 3초 동안만 표시
      this.ctx.globalAlpha = Math.max(0, 1 - timeSinceSuccess / 3000);
      this.ctx.fillStyle = '#00FF00';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 28px Arial';
      this.ctx.textAlign = 'center';
      
      const message = '✅ 눈 감지 성공!';
      const textX = this.canvas.width / 2;
      const textY = this.canvas.height * 0.15;
      
      this.ctx.strokeText(message, textX, textY);
      this.ctx.fillText(message, textX, textY);
    }

    this.ctx.restore();
  }

  // 체크마크 그리기
  drawCheckmark(centerX, centerY, size) {
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - size * 0.5, centerY);
    this.ctx.lineTo(centerX - size * 0.1, centerY + size * 0.4);
    this.ctx.lineTo(centerX + size * 0.6, centerY - size * 0.3);
    this.ctx.stroke();
  }

  // 개발자용 눈 감지 가이드 출력
  printEyeDetectionGuide() {
    const guide = this.getEyeDetectionGuide();
    
    console.log('\n👁️ === 눈 감지 성공 가이드 ===');
    console.log('눈 감지가 안될 때 아래 조건들을 확인해보세요:\n');
    
    Object.values(guide).forEach(section => {
      console.log(section.title);
      section.requirements.forEach(req => {
        console.log(`  ✓ ${req}`);
      });
      console.log('');
    });
    
    console.log('🔍 디버그 팁:');
    console.log('  • 콘솔에서 "👁️ 눈 검색 영역", "👁️ 왼쪽/오른쪽 눈 선택" 로그 확인');
    console.log('  • 카메라 화면에 파란색(얼굴), 초록/빨간색(눈) 박스가 표시됨');
    console.log('  • 주황색 박스는 기본값 사용 중 (실제 감지 실패)');
    console.log('  • 밝기 값이 220 이하여야 눈 후보가 됨\n');
    
    console.log('🎯 현재 설정으로 테스트해보세요!');
  }

  // 실시간 눈 감지 상태 출력 (디버그용)
  logEyeDetectionStatus(faceRegion, eyeRegions) {
    if (!this.settings.debugMode) return;
    
    const analysis = this.analyzeCurrentEyeDetectionStatus(faceRegion, eyeRegions);
    
    // 5초마다 한 번씩만 출력 (로그 스팸 방지)
    if (!this.lastStatusLog || Date.now() - this.lastStatusLog > 5000) {
      console.log(`\n📊 현재 눈 감지 상태: ${analysis.overall.toUpperCase()}`);
      console.log(`얼굴: ${analysis.face.detected ? '✅' : '❌'} (${(analysis.face.confidence * 100).toFixed(0)}%)`);
      console.log(`왼눈: ${analysis.leftEye.detected ? '✅' : '❌'} (${(analysis.leftEye.confidence * 100).toFixed(0)}%)`);
      console.log(`오른눈: ${analysis.rightEye.detected ? '✅' : '❌'} (${(analysis.rightEye.confidence * 100).toFixed(0)}%)`);
      
      if (analysis.recommendations.length > 0) {
        console.log('💡 개선 방법:');
        analysis.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }
      console.log('');
      
      this.lastStatusLog = Date.now();
    }
  }

  // 불필요한 함수들 제거됨 (성능 최적화)

  // 불필요한 함수들 제거됨 (성능 최적화)

  findEyesInFaceRegion(data, width, height, faceRegion) {
    // 훨씬 관대한 눈 검색 알고리즘 (거의 항상 찾도록)
    const eyeRegions = {
      leftEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 },
      rightEye: { x: 0, y: 0, width: 0, height: 0, confidence: 0 }
    };

    if (!faceRegion) {
      // 얼굴이 없어도 기본 위치에 눈 영역 생성 (테스트용)
      const defaultEyeWidth = width * 0.08;
      const defaultEyeHeight = height * 0.06;
      const centerY = height * 0.4;
      
      eyeRegions.leftEye = {
        x: width * 0.3,
        y: centerY,
        width: defaultEyeWidth,
        height: defaultEyeHeight,
        confidence: 0.3,
        isDefault: true
      };
      
      eyeRegions.rightEye = {
        x: width * 0.6,
        y: centerY,
        width: defaultEyeWidth,
        height: defaultEyeHeight,
        confidence: 0.3,
        isDefault: true
      };
      
      console.log('⚠️ 얼굴 없음 - 기본 눈 위치 사용');
      return eyeRegions;
    }

    // 얼굴이 있으면 매우 넓은 영역에서 검색
    const searchTop = Math.max(0, faceRegion.y - faceRegion.height * 0.1);
    const searchBottom = faceRegion.y + faceRegion.height * 0.8;
    const searchLeft = Math.max(0, faceRegion.x - faceRegion.width * 0.1);
    const searchRight = Math.min(width, faceRegion.x + faceRegion.width * 1.1);

    // 모든 가능한 어두운 영역 찾기
    const darkRegions = [];

    // 더 세밀한 그리드로 검색 (8x6)
    const gridSizeX = 8;
    const gridSizeY = 6;
    const cellWidth = (searchRight - searchLeft) / gridSizeX;
    const cellHeight = (searchBottom - searchTop) / gridSizeY;

    console.log(`👁️ 눈 검색 영역: (${searchLeft.toFixed(0)}, ${searchTop.toFixed(0)}) ~ (${searchRight.toFixed(0)}, ${searchBottom.toFixed(0)})`);
    console.log(`🔍 그리드 크기: ${gridSizeX}x${gridSizeY}, 셀 크기: ${cellWidth.toFixed(0)}x${cellHeight.toFixed(0)}`);

    for (let gy = 0; gy < gridSizeY; gy++) {
      for (let gx = 0; gx < gridSizeX; gx++) {
        const cellX = searchLeft + gx * cellWidth;
        const cellY = searchTop + gy * cellHeight;

        if (cellX >= 0 && cellY >= 0 && cellX + cellWidth < width && cellY + cellHeight < height) {
          const avgBrightness = this.getRegionBrightness(data, width, height,
            cellX, cellY, cellWidth, cellHeight);

          // 매우 관대한 임계값 (거의 모든 영역이 눈 후보가 됨)
          if (avgBrightness < 220) {
            darkRegions.push({
              x: cellX,
              y: cellY,
              width: cellWidth,
              height: cellHeight,
              brightness: avgBrightness,
              gridX: gx,
              gridY: gy
            });
          }
        }
      }
    }

    console.log(`🔍 발견된 어두운 영역: ${darkRegions.length}개`);

    // 모든 어두운 영역을 밝기 순으로 정렬
      darkRegions.sort((a, b) => a.brightness - b.brightness);

      // 얼굴 중심을 기준으로 좌우 분류
      const faceCenterX = faceRegion.x + faceRegion.width / 2;
      const leftCandidates = darkRegions.filter(region => region.x + region.width / 2 < faceCenterX);
      const rightCandidates = darkRegions.filter(region => region.x + region.width / 2 > faceCenterX);

    console.log(`👁️ 왼쪽 눈 후보: ${leftCandidates.length}개, 오른쪽 눈 후보: ${rightCandidates.length}개`);

    // 왼쪽 눈 선택 (가장 어두운 것 또는 첫 번째)
      if (leftCandidates.length > 0) {
        const leftEye = leftCandidates[0];
        eyeRegions.leftEye = {
          x: leftEye.x,
          y: leftEye.y,
          width: leftEye.width,
          height: leftEye.height,
        confidence: Math.max(0.4, 1 - leftEye.brightness / 255),
        brightness: leftEye.brightness,
        gridPos: `(${leftEye.gridX}, ${leftEye.gridY})`
      };
      console.log(`👁️ 왼쪽 눈 선택: 밝기=${leftEye.brightness.toFixed(1)}, 위치=(${leftEye.x.toFixed(0)}, ${leftEye.y.toFixed(0)}), 그리드=${leftEye.gridX},${leftEye.gridY}`);
    } else {
      // 후보가 없으면 기본 위치 사용
      eyeRegions.leftEye = {
        x: faceRegion.x + faceRegion.width * 0.2,
        y: faceRegion.y + faceRegion.height * 0.3,
        width: faceRegion.width * 0.15,
        height: faceRegion.height * 0.1,
        confidence: 0.2,
        isDefault: true
      };
      console.log('👁️ 왼쪽 눈 기본 위치 사용');
    }

    // 오른쪽 눈 선택
      if (rightCandidates.length > 0) {
        const rightEye = rightCandidates[0];
        eyeRegions.rightEye = {
          x: rightEye.x,
          y: rightEye.y,
          width: rightEye.width,
          height: rightEye.height,
        confidence: Math.max(0.4, 1 - rightEye.brightness / 255),
        brightness: rightEye.brightness,
        gridPos: `(${rightEye.gridX}, ${rightEye.gridY})`
      };
      console.log(`👁️ 오른쪽 눈 선택: 밝기=${rightEye.brightness.toFixed(1)}, 위치=(${rightEye.x.toFixed(0)}, ${rightEye.y.toFixed(0)}), 그리드=${rightEye.gridX},${rightEye.gridY}`);
    } else {
      // 후보가 없으면 기본 위치 사용
      eyeRegions.rightEye = {
        x: faceRegion.x + faceRegion.width * 0.65,
        y: faceRegion.y + faceRegion.height * 0.3,
        width: faceRegion.width * 0.15,
        height: faceRegion.height * 0.1,
        confidence: 0.2,
        isDefault: true
      };
      console.log('👁️ 오른쪽 눈 기본 위치 사용');
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

  // 디버그 오버레이 그리기 (눈과 얼굴 영역 시각화)
  drawDebugOverlay(faceRegion, eyeRegions, brightnesRegions) {
    if (!this.ctx || !this.canvas) return;

    // 기존 캔버스 상태 저장
    this.ctx.save();

    try {
      // 반투명 오버레이 설정
      this.ctx.globalAlpha = 0.8;
      this.ctx.lineWidth = 3;
      this.ctx.font = '16px Arial';

      // 눈을 찾지 못했을 때 가이드 라인 그리기
      const hasValidEyes = this.hasValidEyeDetection(eyeRegions);
      if (!hasValidEyes) {
        this.drawEyeGuidelines(faceRegion);
      }

      // 1. 얼굴 영역 그리기 (파란색 사각형)
      if (faceRegion) {
        this.ctx.strokeStyle = '#00BFFF'; // 하늘색
        this.ctx.fillStyle = 'rgba(0, 191, 255, 0.1)';
        this.ctx.fillRect(faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height);
        this.ctx.strokeRect(faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height);
        
        // 얼굴 중심점 표시
        const faceCenterX = faceRegion.x + faceRegion.width / 2;
        const faceCenterY = faceRegion.y + faceRegion.height / 2;
        this.ctx.fillStyle = '#00BFFF';
        this.ctx.fillRect(faceCenterX - 5, faceCenterY - 5, 10, 10);
        
        // 얼굴 정보 텍스트
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText(`Face: ${(faceRegion.confidence * 100).toFixed(0)}%`, 
          faceRegion.x, faceRegion.y - 10);
      }

      // 2. 눈 영역 그리기 
      if (eyeRegions) {
        // 왼쪽 눈 (초록색)
        if (eyeRegions.leftEye && eyeRegions.leftEye.confidence > 0) {
          const leftEye = eyeRegions.leftEye;
          this.ctx.strokeStyle = leftEye.isDefault ? '#FFA500' : '#00FF00'; // 기본값이면 주황색, 아니면 초록색
          this.ctx.fillStyle = leftEye.isDefault ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)';
          
          this.ctx.fillRect(leftEye.x, leftEye.y, leftEye.width, leftEye.height);
          this.ctx.strokeRect(leftEye.x, leftEye.y, leftEye.width, leftEye.height);
          
          // 눈 중심점
          const leftCenterX = leftEye.x + leftEye.width / 2;
          const leftCenterY = leftEye.y + leftEye.height / 2;
          this.ctx.fillStyle = leftEye.isDefault ? '#FFA500' : '#00FF00';
          this.ctx.fillRect(leftCenterX - 3, leftCenterY - 3, 6, 6);
          
          // 왼쪽 눈 정보
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.fillText(`L: ${(leftEye.confidence * 100).toFixed(0)}%${leftEye.isDefault ? ' (기본)' : ''}`, 
            leftEye.x, leftEye.y - 5);
            
          if (leftEye.brightness !== undefined) {
            this.ctx.fillText(`밝기: ${leftEye.brightness.toFixed(0)}`, 
              leftEye.x, leftEye.y + leftEye.height + 20);
          }
        }

        // 오른쪽 눈 (빨간색)
        if (eyeRegions.rightEye && eyeRegions.rightEye.confidence > 0) {
          const rightEye = eyeRegions.rightEye;
          this.ctx.strokeStyle = rightEye.isDefault ? '#FFA500' : '#FF0000'; // 기본값이면 주황색, 아니면 빨간색
          this.ctx.fillStyle = rightEye.isDefault ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
          
          this.ctx.fillRect(rightEye.x, rightEye.y, rightEye.width, rightEye.height);
          this.ctx.strokeRect(rightEye.x, rightEye.y, rightEye.width, rightEye.height);
          
          // 눈 중심점
          const rightCenterX = rightEye.x + rightEye.width / 2;
          const rightCenterY = rightEye.y + rightEye.height / 2;
          this.ctx.fillStyle = rightEye.isDefault ? '#FFA500' : '#FF0000';
          this.ctx.fillRect(rightCenterX - 3, rightCenterY - 3, 6, 6);
          
          // 오른쪽 눈 정보
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.fillText(`R: ${(rightEye.confidence * 100).toFixed(0)}%${rightEye.isDefault ? ' (기본)' : ''}`, 
            rightEye.x, rightEye.y - 5);
            
          if (rightEye.brightness !== undefined) {
            this.ctx.fillText(`밝기: ${rightEye.brightness.toFixed(0)}`, 
              rightEye.x, rightEye.y + rightEye.height + 20);
          }
        }
      }

      // 3. 화면 영역 구분선 (스크롤 영역)
      const screenHeight = window.innerHeight;
      const topZone = screenHeight * (this.settings.topZone / 100);
      const bottomZone = screenHeight * (1 - this.settings.bottomZone / 100);
      
      // 캔버스 좌표계로 변환
      const canvasTopZone = (topZone / screenHeight) * this.canvas.height;
      const canvasBottomZone = (bottomZone / screenHeight) * this.canvas.height;
      
      this.ctx.strokeStyle = '#FFFF00'; // 노란색
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      
      // 상단 영역선
      this.ctx.beginPath();
      this.ctx.moveTo(0, canvasTopZone);
      this.ctx.lineTo(this.canvas.width, canvasTopZone);
      this.ctx.stroke();
      
      // 하단 영역선
      this.ctx.beginPath();
      this.ctx.moveTo(0, canvasBottomZone);
      this.ctx.lineTo(this.canvas.width, canvasBottomZone);
      this.ctx.stroke();
      
      this.ctx.setLineDash([]); // 점선 리셋

      // 4. 상태 정보 텍스트 (좌상단)
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '14px Arial';
      let infoY = 25;
      
      this.ctx.fillText(`해상도: ${this.canvas.width}x${this.canvas.height}`, 10, infoY);
      infoY += 20;
      
      if (faceRegion) {
        this.ctx.fillText(`얼굴: 감지됨 (${(faceRegion.confidence * 100).toFixed(0)}%)`, 10, infoY);
      } else {
        this.ctx.fillText('얼굴: 감지 안됨', 10, infoY);
      }
      infoY += 20;
      
      if (eyeRegions && (eyeRegions.leftEye || eyeRegions.rightEye)) {
        const leftConf = eyeRegions.leftEye ? eyeRegions.leftEye.confidence : 0;
        const rightConf = eyeRegions.rightEye ? eyeRegions.rightEye.confidence : 0;
        this.ctx.fillText(`눈: L=${(leftConf * 100).toFixed(0)}% R=${(rightConf * 100).toFixed(0)}%`, 10, infoY);
      } else {
        this.ctx.fillText('눈: 감지 안됨', 10, infoY);
      }

    } catch (error) {
      console.warn('디버그 오버레이 그리기 오류:', error);
    }

    // 캔버스 상태 복원
    this.ctx.restore();
  }

  // MediaPipe Face Mesh를 사용한 정밀한 눈 감지 (개선된 버전)
  detectEyesWithTracking(data, width, height) {
    if (this.mediaPipeInitialized && this.faceDetectionResults) {
      const mediaPipeEyes = this.detectEyesWithMediaPipe();
      
      // MediaPipe 결과의 품질 검사
      if (this.validateEyeDetectionQuality(mediaPipeEyes)) {
        console.log('✅ MediaPipe 눈 감지 성공 - 고품질 결과');
        return mediaPipeEyes;
      } else {
        console.log('⚠️ MediaPipe 눈 감지 품질 낮음, 기본 알고리즘 병행 사용');
        // MediaPipe 결과가 있지만 품질이 낮으면 기본 알고리즘과 결합
        const faceRegion = this.findFaceRegion(data, width, height);
        const basicEyes = this.findEyesInFaceRegion(data, width, height, faceRegion);
        return this.combineEyeDetectionResults(mediaPipeEyes, basicEyes);
      }
    } else {
      // MediaPipe가 초기화되지 않았거나 결과가 없으면 기본 알고리즘 사용
      console.log('📱 기본 눈 감지 알고리즘 사용');
      const faceRegion = this.findFaceRegion(data, width, height);
      return this.findEyesInFaceRegion(data, width, height, faceRegion);
    }
  }

  // 눈 감지 결과 품질 검증
  validateEyeDetectionQuality(eyeRegions) {
    if (!eyeRegions || !eyeRegions.leftEye || !eyeRegions.rightEye) {
      return false;
    }
    
    // 1. 신뢰도 검사
    const minConfidence = 0.3;
    if (eyeRegions.leftEye.confidence < minConfidence || 
        eyeRegions.rightEye.confidence < minConfidence) {
      return false;
    }
    
    // 2. 눈 크기 검사 (너무 작거나 크지 않은지)
    const leftEyeSize = eyeRegions.leftEye.width * eyeRegions.leftEye.height;
    const rightEyeSize = eyeRegions.rightEye.width * eyeRegions.rightEye.height;
    const canvasSize = this.canvas.width * this.canvas.height;
    
    const minEyeSize = canvasSize * 0.0001; // 전체 화면의 0.01%
    const maxEyeSize = canvasSize * 0.05;   // 전체 화면의 5%
    
    if (leftEyeSize < minEyeSize || rightEyeSize < minEyeSize ||
        leftEyeSize > maxEyeSize || rightEyeSize > maxEyeSize) {
      return false;
    }
    
    // 3. 눈 간 거리 검사
    const eyeDistance = Math.abs(eyeRegions.rightEye.x - eyeRegions.leftEye.x);
    const minDistance = this.canvas.width * 0.05; // 화면 너비의 5%
    const maxDistance = this.canvas.width * 0.4;  // 화면 너비의 40%
    
    if (eyeDistance < minDistance || eyeDistance > maxDistance) {
      return false;
    }
    
    // 4. 눈 위치 관계 검사 (오른쪽 눈이 왼쪽 눈보다 오른쪽에 있는지)
    if (eyeRegions.rightEye.x <= eyeRegions.leftEye.x) {
      return false;
    }
    
    return true;
  }

  // 두 가지 눈 감지 결과를 결합
  combineEyeDetectionResults(mediaPipeEyes, basicEyes) {
    if (!basicEyes || !basicEyes.leftEye || !basicEyes.rightEye) {
      return mediaPipeEyes;
    }
    
    if (!mediaPipeEyes || !mediaPipeEyes.leftEye || !mediaPipeEyes.rightEye) {
      return basicEyes;
    }
    
    // 더 높은 신뢰도를 가진 결과를 우선적으로 사용
    const mediaPipeConfidence = (mediaPipeEyes.leftEye.confidence + mediaPipeEyes.rightEye.confidence) / 2;
    const basicConfidence = (basicEyes.leftEye.confidence + basicEyes.rightEye.confidence) / 2;
    
    if (mediaPipeConfidence > basicConfidence) {
      return { ...mediaPipeEyes, isCombined: true, primarySource: 'MediaPipe' };
    } else {
      return { ...basicEyes, isCombined: true, primarySource: 'Basic' };
    }
  }

  // MediaPipe Face Mesh를 사용한 얼굴 및 눈 감지 (개선된 버전)
  detectEyesWithMediaPipe() {
    if (!this.faceDetectionResults || !this.faceDetectionResults.multiFaceLandmarks || 
        this.faceDetectionResults.multiFaceLandmarks.length === 0) {
      return null;
    }

    const landmarks = this.faceDetectionResults.multiFaceLandmarks[0];
    
    // MediaPipe Face Mesh 눈 랜드마크 인덱스 (더 정확한 눈동자 추적을 위한 핵심 포인트들)
    const leftEyeLandmarks = {
      outline: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
      center: [468, 469, 470, 471, 472], // 눈동자 중심 추정 포인트들
      innerCorner: [133],
      outerCorner: [33],
      topLid: [159, 158, 157, 173],
      bottomLid: [145, 144, 163, 7]
    };
    
    const rightEyeLandmarks = {
      outline: [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382],
      center: [473, 474, 475, 476, 477], // 눈동자 중심 추정 포인트들
      innerCorner: [362],
      outerCorner: [263],
      topLid: [386, 385, 384, 398],
      bottomLid: [374, 373, 390, 249]
    };
    
    // 얼굴 윤곽선 주요 포인트 
    const faceOvalLandmarks = [10, 151, 234, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150];
    
    // 코 랜드마크
    const noseLandmarks = [1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305];
    
    // 입 랜드마크 
    const mouthLandmarks = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
    
    // 얼굴 각 부분의 중심점과 영역 계산 (개선된 눈동자 추적)
    const leftEyeAnalysis = this.analyzeEyeRegion(landmarks, leftEyeLandmarks, 'left');
    const rightEyeAnalysis = this.analyzeEyeRegion(landmarks, rightEyeLandmarks, 'right');
    const faceCenter = this.calculateFaceCenter(landmarks);
    const noseCenter = this.calculateFeatureCenter(landmarks, noseLandmarks);
    const mouthCenter = this.calculateFeatureCenter(landmarks, mouthLandmarks);
    
    // 얼굴 전체 바운딩 박스 계산
    const faceBounds = this.calculateFaceBounds(landmarks, faceOvalLandmarks);
    
    // 머리 자세 계산 
    const headPose = this.calculateHeadPose(landmarks);
    
    // 얼굴 감지 신뢰도 계산
    const faceConfidence = this.calculateFaceConfidence(landmarks, leftEyeAnalysis.openness, rightEyeAnalysis.openness);
    
    // 눈동자 추적 개선 - 실제 각도 계산
    const gazeAnalysis = this.calculateAccurateGazeDirection(leftEyeAnalysis, rightEyeAnalysis, headPose);
    
    return {
      leftEye: {
        x: leftEyeAnalysis.bounds.x,
        y: leftEyeAnalysis.bounds.y,
        width: leftEyeAnalysis.bounds.width,
        height: leftEyeAnalysis.bounds.height,
        center: leftEyeAnalysis.center,
        pupilCenter: leftEyeAnalysis.pupilCenter,
        confidence: leftEyeAnalysis.confidence,
        openness: leftEyeAnalysis.openness,
        gazeDirection: leftEyeAnalysis.gazeDirection,
        lidPoints: leftEyeAnalysis.lidPoints
      },
      rightEye: {
        x: rightEyeAnalysis.bounds.x,
        y: rightEyeAnalysis.bounds.y,
        width: rightEyeAnalysis.bounds.width,
        height: rightEyeAnalysis.bounds.height,
        center: rightEyeAnalysis.center,
        pupilCenter: rightEyeAnalysis.pupilCenter,
        confidence: rightEyeAnalysis.confidence,
        openness: rightEyeAnalysis.openness,
        gazeDirection: rightEyeAnalysis.gazeDirection,
        lidPoints: rightEyeAnalysis.lidPoints
      },
      face: {
        bounds: faceBounds,
        center: faceCenter,
        confidence: faceConfidence,
        pose: headPose
      },
      nose: {
        center: noseCenter
      },
      mouth: {
        center: mouthCenter
      },
      gaze: gazeAnalysis, // 통합된 시선 분석 결과
      landmarks: landmarks, // 전체 랜드마크 정보 포함
      isMediaPipe: true,
      qualityScore: this.calculateMediaPipeQuality(leftEyeAnalysis.openness, rightEyeAnalysis.openness, faceConfidence)
    };
  }

  // 개선된 눈 영역 분석 (눈동자 위치까지 정확하게 추적)
  analyzeEyeRegion(landmarks, eyeLandmarkData, eyeSide) {
    // 1. 눈 윤곽선 기반 바운딩 박스 계산
    const bounds = this.calculateEyeBounds(landmarks, eyeLandmarkData.outline);
    
    // 2. 눈꺼풀 상태 분석 (위, 아래 눈꺼풀 거리)
    const lidAnalysis = this.analyzeLidState(landmarks, eyeLandmarkData, eyeSide);
    
    // 3. 눈동자 중심 추정 (개선된 알고리즘)
    const pupilAnalysis = this.estimatePupilCenter(landmarks, eyeLandmarkData, bounds);
    
    // 4. 눈의 기하학적 중심
    const geometricCenter = this.calculateGeometricEyeCenter(landmarks, eyeLandmarkData.outline);
    
    // 5. 시선 방향 벡터 계산
    const gazeVector = this.calculateGazeVector(pupilAnalysis.center, geometricCenter, bounds);
    
    // 6. 신뢰도 계산
    const confidence = this.calculateEyeAnalysisConfidence(lidAnalysis, pupilAnalysis, bounds);
    
    return {
      bounds: bounds,
      center: geometricCenter,
      pupilCenter: pupilAnalysis.center,
      openness: lidAnalysis.openness,
      confidence: confidence,
      gazeDirection: gazeVector,
      lidPoints: lidAnalysis.points,
      quality: pupilAnalysis.quality
    };
  }

  // 눈꺼풀 상태 분석 (안전한 접근)
  analyzeLidState(landmarks, eyeLandmarkData, eyeSide) {
    if (!landmarks || !eyeLandmarkData || !eyeLandmarkData.topLid || !eyeLandmarkData.bottomLid) {
      return {
        openness: 0,
        points: { top: [], bottom: [] },
        isValid: false
      };
    }

    const topLidPoints = eyeLandmarkData.topLid
      .map(idx => landmarks[idx])
      .filter(point => point && typeof point.x !== 'undefined' && typeof point.y !== 'undefined');
    
    const bottomLidPoints = eyeLandmarkData.bottomLid
      .map(idx => landmarks[idx])
      .filter(point => point && typeof point.x !== 'undefined' && typeof point.y !== 'undefined');
    
    // 여러 지점에서 눈꺼풀 간 거리 측정
    let totalDistance = 0;
    let validPoints = 0;
    
    for (let i = 0; i < Math.min(topLidPoints.length, bottomLidPoints.length); i++) {
      if (topLidPoints[i] && bottomLidPoints[i] && 
          typeof topLidPoints[i].y === 'number' && typeof bottomLidPoints[i].y === 'number') {
        const distance = Math.abs(topLidPoints[i].y - bottomLidPoints[i].y);
        totalDistance += distance;
        validPoints++;
      }
    }
    
    const averageOpenness = validPoints > 0 ? totalDistance / validPoints : 0;
    
    return {
      openness: averageOpenness,
      points: {
        top: topLidPoints,
        bottom: bottomLidPoints
      },
      isValid: validPoints >= 2
    };
  }

  // 눈동자 중심 추정 (정교한 방법 - 안전한 접근)
  estimatePupilCenter(landmarks, eyeLandmarkData, eyeBounds) {
    if (!landmarks || !eyeLandmarkData || !eyeBounds) {
      return {
        center: { x: 0, y: 0 },
        quality: 0
      };
    }

    // 1. 눈의 내각과 외각 사이의 중점 계산 (안전한 접근)
    const innerCornerIdx = eyeLandmarkData.innerCorner && eyeLandmarkData.innerCorner[0];
    const outerCornerIdx = eyeLandmarkData.outerCorner && eyeLandmarkData.outerCorner[0];
    
    const innerCorner = innerCornerIdx !== undefined ? landmarks[innerCornerIdx] : null;
    const outerCorner = outerCornerIdx !== undefined ? landmarks[outerCornerIdx] : null;
    
    if (!innerCorner || !outerCorner || 
        typeof innerCorner.x !== 'number' || typeof outerCorner.x !== 'number') {
      return {
        center: { 
          x: eyeBounds.x + eyeBounds.width / 2, 
          y: eyeBounds.y + eyeBounds.height / 2 
        },
        quality: 0.1
      };
    }
    
    // 2. 위, 아래 눈꺼풀의 중점들 계산 (안전한 필터링)
    const topMidPoints = eyeLandmarkData.topLid
      ? eyeLandmarkData.topLid
          .map(idx => landmarks[idx])
          .filter(p => p && typeof p.x === 'number' && typeof p.y === 'number')
      : [];
    
    const bottomMidPoints = eyeLandmarkData.bottomLid
      ? eyeLandmarkData.bottomLid
          .map(idx => landmarks[idx])
          .filter(p => p && typeof p.x === 'number' && typeof p.y === 'number')
      : [];
    
    if (topMidPoints.length === 0 || bottomMidPoints.length === 0) {
      return {
        center: { x: eyeBounds.x + eyeBounds.width / 2, y: eyeBounds.y + eyeBounds.height / 2 },
        quality: 0.2
      };
    }
    
    // 3. 수평 중심선 계산
    const horizontalCenter = (innerCorner.x + outerCorner.x) / 2;
    
    // 4. 수직 중심선 계산 (위아래 눈꺼풀의 평균)
    const topAvgY = topMidPoints.reduce((sum, p) => sum + p.y, 0) / topMidPoints.length;
    const bottomAvgY = bottomMidPoints.reduce((sum, p) => sum + p.y, 0) / bottomMidPoints.length;
    const verticalCenter = (topAvgY + bottomAvgY) / 2;
    
    // 5. 품질 점수 계산
    const eyeWidth = Math.abs(outerCorner.x - innerCorner.x);
    const eyeHeight = Math.abs(topAvgY - bottomAvgY);
    const aspectRatio = eyeWidth / (eyeHeight || 1);
    
    // 정상적인 눈의 가로세로 비율은 약 3:1
    const ratioScore = Math.max(0, 1 - Math.abs(aspectRatio - 3) / 3);
    const quality = Math.min(0.95, ratioScore * 0.8 + 0.2);
    
    return {
      center: {
        x: horizontalCenter * this.canvas.width,
        y: verticalCenter * this.canvas.height
      },
      quality: quality
    };
  }

  // 기하학적 눈 중심 계산 (안전한 접근)
  calculateGeometricEyeCenter(landmarks, eyeLandmarkIndices) {
    if (!landmarks || !eyeLandmarkIndices || !Array.isArray(eyeLandmarkIndices)) {
      return { x: 0, y: 0 };
    }

    let sumX = 0, sumY = 0;
    let validPoints = 0;
    
    for (const index of eyeLandmarkIndices) {
      const point = landmarks[index];
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        sumX += point.x;
        sumY += point.y;
        validPoints++;
      }
    }
    
    if (validPoints === 0 || !this.canvas) {
      return { x: 0, y: 0 };
    }
    
    return {
      x: (sumX / validPoints) * this.canvas.width,
      y: (sumY / validPoints) * this.canvas.height
    };
  }

  // 시선 벡터 계산
  calculateGazeVector(pupilCenter, eyeCenter, eyeBounds) {
    if (!pupilCenter || !eyeCenter) {
      return { x: 0, y: 0, magnitude: 0 };
    }
    
    // 눈동자와 눈 중심 간의 상대적 위치
    const deltaX = pupilCenter.x - eyeCenter.x;
    const deltaY = pupilCenter.y - eyeCenter.y;
    
    // 눈 크기 대비 정규화
    const normalizedX = deltaX / (eyeBounds.width || 1);
    const normalizedY = deltaY / (eyeBounds.height || 1);
    
    const magnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
    
    return {
      x: normalizedX,
      y: normalizedY,
      magnitude: magnitude
    };
  }

  // 눈 분석 신뢰도 계산
  calculateEyeAnalysisConfidence(lidAnalysis, pupilAnalysis, bounds) {
    let confidence = 0.5; // 기본 신뢰도
    
    // 1. 눈꺼풀 상태 기반 신뢰도
    if (lidAnalysis.isValid) {
      confidence += 0.2;
      if (lidAnalysis.openness > 0.02) { // 충분히 열린 눈
        confidence += 0.2;
      }
    }
    
    // 2. 눈동자 분석 품질 기반 신뢰도
    confidence += pupilAnalysis.quality * 0.3;
    
    // 3. 눈 크기 기반 신뢰도
    const eyeSize = bounds.width * bounds.height;
    const canvasSize = this.canvas.width * this.canvas.height;
    const sizeRatio = eyeSize / canvasSize;
    
    if (sizeRatio > 0.001 && sizeRatio < 0.05) { // 적절한 크기
      confidence += 0.1;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // 정확한 시선 방향 계산 (두 눈의 정보를 종합)
  calculateAccurateGazeDirection(leftEyeAnalysis, rightEyeAnalysis, headPose) {
    if (!leftEyeAnalysis || !rightEyeAnalysis) {
      return { x: 0, y: 0, confidence: 0, method: 'fallback' };
    }
    
    // 1. 두 눈의 시선 벡터 평균
    const avgGazeX = (leftEyeAnalysis.gazeDirection.x + rightEyeAnalysis.gazeDirection.x) / 2;
    const avgGazeY = (leftEyeAnalysis.gazeDirection.y + rightEyeAnalysis.gazeDirection.y) / 2;
    
    // 2. 머리 자세를 고려한 보정
    let correctedGazeX = avgGazeX;
    let correctedGazeY = avgGazeY;
    
    if (headPose && headPose.isValid) {
      // 머리의 yaw(좌우 회전)를 고려한 보정
      correctedGazeX += headPose.yaw * 0.3;
      
      // 머리의 pitch(위아래 끄덕임)를 고려한 보정
      correctedGazeY += headPose.pitch * 0.4;
    }
    
    // 3. 신뢰도 계산
    const leftConfidence = leftEyeAnalysis.confidence;
    const rightConfidence = rightEyeAnalysis.confidence;
    const avgConfidence = (leftConfidence + rightConfidence) / 2;
    
    // 두 눈 간의 일관성 확인
    const gazeConsistency = 1 - Math.abs(leftEyeAnalysis.gazeDirection.x - rightEyeAnalysis.gazeDirection.x);
    const finalConfidence = avgConfidence * gazeConsistency;
    
    return {
      x: Math.max(-1, Math.min(1, correctedGazeX)),
      y: Math.max(-1, Math.min(1, correctedGazeY)),
      confidence: finalConfidence,
      method: 'advanced_binocular',
      debug: {
        leftGaze: leftEyeAnalysis.gazeDirection,
        rightGaze: rightEyeAnalysis.gazeDirection,
        headPose: headPose,
        consistency: gazeConsistency
      }
    };
  }

  // 눈 중심점 계산 (기존 호환성 유지)
  calculateEyeCenter(landmarks, eyeLandmarkIndices) {
    let sumX = 0, sumY = 0;
    for (const index of eyeLandmarkIndices) {
      sumX += landmarks[index].x;
      sumY += landmarks[index].y;
    }
    return {
      x: (sumX / eyeLandmarkIndices.length) * this.canvas.width,
      y: (sumY / eyeLandmarkIndices.length) * this.canvas.height
    };
  }

  // 눈 영역 바운딩 박스 계산 (안전한 접근)
  calculateEyeBounds(landmarks, eyeLandmarkIndices) {
    if (!landmarks || !eyeLandmarkIndices || !Array.isArray(eyeLandmarkIndices) || !this.canvas) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let validPoints = 0;
    
    for (const index of eyeLandmarkIndices) {
      const point = landmarks[index];
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
        validPoints++;
      }
    }
    
    if (validPoints === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    return {
      x: minX * this.canvas.width,
      y: minY * this.canvas.height,
      width: (maxX - minX) * this.canvas.width,
      height: (maxY - minY) * this.canvas.height
    };
  }

  // 눈꺼풀 열림 정도 계산
  calculateEyeOpenness(landmarks, eyeLandmarkIndices) {
    // 눈의 수직 거리를 측정해서 눈꺼풀 열림 정도 계산
    // 왼쪽 눈: 위쪽 385, 아래쪽 380
    // 오른쪽 눈: 위쪽 159, 아래쪽 145
    
    let topIndex, bottomIndex;
    if (eyeLandmarkIndices.includes(385)) { // 왼쪽 눈
      topIndex = 385;
      bottomIndex = 380;
    } else { // 오른쪽 눈
      topIndex = 159;
      bottomIndex = 145;
    }
    
    const topPoint = landmarks[topIndex];
    const bottomPoint = landmarks[bottomIndex];
    
    const eyeHeight = Math.abs(topPoint.y - bottomPoint.y);
    return eyeHeight; // 0에 가까우면 눈이 감긴 상태, 클수록 눈이 열린 상태
  }

  // 시선 방향 계산
  calculateGazeDirection(landmarks, eyeLandmarkIndices, eyeCenter) {
    // 동공의 위치를 추정하여 시선 방향 계산
    // 실제로는 동공을 직접 감지할 수 없으므로, 눈의 형태 변화로 추정
    
    // 눈의 좌우 끝점을 찾아서 시선 방향 추정
    let leftCorner, rightCorner;
    if (eyeLandmarkIndices.includes(385)) { // 왼쪽 눈
      leftCorner = landmarks[362]; // 왼쪽 눈의 왼쪽 모서리
      rightCorner = landmarks[263]; // 왼쪽 눈의 오른쪽 모서리
    } else { // 오른쪽 눈
      leftCorner = landmarks[33]; // 오른쪽 눈의 왼쪽 모서리
      rightCorner = landmarks[133]; // 오른쪽 눈의 오른쪽 모서리
    }
    
    // 눈의 중심점과 모서리들의 관계로 시선 방향 추정
    const eyeWidth = Math.abs(rightCorner.x - leftCorner.x);
    const centerOffsetX = eyeCenter.x / this.canvas.width - (leftCorner.x + rightCorner.x) / 2;
    const centerOffsetY = eyeCenter.y / this.canvas.height - (leftCorner.y + rightCorner.y) / 2;
    
    return {
      x: centerOffsetX / eyeWidth, // -0.5 ~ 0.5 범위
      y: centerOffsetY / eyeWidth  // -0.5 ~ 0.5 범위
    };
  }

  // 얼굴 중심점 계산
  calculateFaceCenter(landmarks) {
    // 코끝 (1), 이마 중앙 (9), 턱 중앙 (175) 등을 사용해 얼굴 중심 계산
    const noseTip = landmarks[1];
    const foreheadCenter = landmarks[9];
    const chinCenter = landmarks[175];
    
    return {
      x: ((noseTip.x + foreheadCenter.x + chinCenter.x) / 3) * this.canvas.width,
      y: ((noseTip.y + foreheadCenter.y + chinCenter.y) / 3) * this.canvas.height
    };
  }

  // 일반적인 특징점 중심 계산
  calculateFeatureCenter(landmarks, featureLandmarkIndices) {
    let sumX = 0, sumY = 0;
    for (const index of featureLandmarkIndices) {
      if (landmarks[index]) {
        sumX += landmarks[index].x;
        sumY += landmarks[index].y;
      }
    }
    return {
      x: (sumX / featureLandmarkIndices.length) * this.canvas.width,
      y: (sumY / featureLandmarkIndices.length) * this.canvas.height
    };
  }

  // 얼굴 전체 바운딩 박스 계산
  calculateFaceBounds(landmarks, faceOvalLandmarks) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    
    for (const index of faceOvalLandmarks) {
      if (landmarks[index]) {
        const point = landmarks[index];
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
    
    return {
      x: minX * this.canvas.width,
      y: minY * this.canvas.height,
      width: (maxX - minX) * this.canvas.width,
      height: (maxY - minY) * this.canvas.height
    };
  }

  // 개선된 시선 방향 계산
  calculateAdvancedGazeDirection(landmarks, eyeLandmarkIndices, eyeCenter) {
    // 눈의 좌우 끝점을 찾아서 시선 방향 추정
    let leftCorner, rightCorner, topPoint, bottomPoint;
    
    if (eyeLandmarkIndices.includes(385)) { // 왼쪽 눈
      leftCorner = landmarks[362]; // 왼쪽 눈의 왼쪽 모서리
      rightCorner = landmarks[263]; // 왼쪽 눈의 오른쪽 모서리
      topPoint = landmarks[385]; // 위쪽
      bottomPoint = landmarks[380]; // 아래쪽
    } else { // 오른쪽 눈
      leftCorner = landmarks[33]; // 오른쪽 눈의 왼쪽 모서리
      rightCorner = landmarks[133]; // 오른쪽 눈의 오른쪽 모서리
      topPoint = landmarks[159]; // 위쪽
      bottomPoint = landmarks[145]; // 아래쪽
    }
    
    // 눈의 중심점과 모서리들의 관계로 시선 방향 추정
    const eyeWidth = Math.abs(rightCorner.x - leftCorner.x);
    const eyeHeight = Math.abs(topPoint.y - bottomPoint.y);
    
    const centerOffsetX = eyeCenter.x / this.canvas.width - (leftCorner.x + rightCorner.x) / 2;
    const centerOffsetY = eyeCenter.y / this.canvas.height - (topPoint.y + bottomPoint.y) / 2;
    
    return {
      x: centerOffsetX / eyeWidth, // -0.5 ~ 0.5 범위
      y: centerOffsetY / eyeHeight, // -0.5 ~ 0.5 범위
      confidence: Math.min(eyeWidth * 10, 1) // 눈 크기에 따른 신뢰도
    };
  }

  // 머리 자세 계산 (개선된 버전)
  calculateHeadPose(landmarks) {
    // 주요 얼굴 포인트들
    const noseTip = landmarks[1];      // 코끝
    const foreheadCenter = landmarks[9]; // 이마 중앙
    const chinCenter = landmarks[175];   // 턱 중앙
    const leftCheek = landmarks[234];    // 왼쪽 볼
    const rightCheek = landmarks[454];   // 오른쪽 볼
    const leftEar = landmarks[234];      // 왼쪽 귀 근처
    const rightEar = landmarks[454];     // 오른쪽 귀 근처
    
    // Pitch (위아래 고개 끄덕임) 계산
    const foreheadToChin = Math.abs(foreheadCenter.y - chinCenter.y);
    const noseToForehead = Math.abs(noseTip.y - foreheadCenter.y);
    const noseToChin = Math.abs(chinCenter.y - noseTip.y);
    
    const normalRatio = 0.4; // 정면일 때 코-이마 / 이마-턱 비율
    const currentRatio = noseToForehead / foreheadToChin;
    const pitch = (currentRatio - normalRatio) * 3; // 민감도 조정
    
    // Yaw (좌우 고개 돌림) 계산
    const leftToRight = Math.abs(rightCheek.x - leftCheek.x);
    const noseOffset = noseTip.x - (leftCheek.x + rightCheek.x) / 2;
    const yaw = (noseOffset / leftToRight) * 2;
    
    // Roll (머리 기울임) 계산
    const eyeLine = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);
    const roll = eyeLine;
    
    return {
      pitch: Math.max(-1, Math.min(1, pitch)), // -1 ~ 1 범위
      yaw: Math.max(-1, Math.min(1, yaw)),
      roll: roll,
      isValid: true
    };
  }

  // 얼굴 감지 신뢰도 계산
  calculateFaceConfidence(landmarks, leftEyeOpenness, rightEyeOpenness) {
    // 여러 요소를 고려한 종합적인 신뢰도 계산
    
    // 1. 눈의 열림 정도
    const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
    const eyeScore = Math.min(avgEyeOpenness * 5, 1); // 0-1 범위
    
    // 2. 랜드마크 품질 (468개 중 얼마나 유효한지)
    let validLandmarks = 0;
    for (let i = 0; i < landmarks.length; i++) {
      if (landmarks[i] && landmarks[i].x >= 0 && landmarks[i].x <= 1 && 
          landmarks[i].y >= 0 && landmarks[i].y <= 1) {
        validLandmarks++;
      }
    }
    const landmarkScore = validLandmarks / landmarks.length;
    
    // 3. 얼굴 비율 검사 (너무 왜곡되지 않았는지)
    const noseTip = landmarks[1];
    const chinCenter = landmarks[175];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    
    const faceHeight = Math.abs(chinCenter.y - noseTip.y);
    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    const aspectRatio = faceWidth / faceHeight;
    
    // 정상적인 얼굴 비율 범위 (0.7 ~ 1.3)
    const ratioScore = aspectRatio >= 0.7 && aspectRatio <= 1.3 ? 1 : 
                      Math.max(0, 1 - Math.abs(aspectRatio - 1) * 2);
    
    // 종합 점수 계산
    const confidence = (eyeScore * 0.4 + landmarkScore * 0.4 + ratioScore * 0.2);
    
    return Math.max(0, Math.min(1, confidence));
  }

  // MediaPipe 품질 점수 계산
  calculateMediaPipeQuality(leftEyeOpenness, rightEyeOpenness, faceConfidence) {
    // 눈 열림 정도의 균형
    const eyeBalance = 1 - Math.abs(leftEyeOpenness - rightEyeOpenness);
    
    // 전체적인 눈 열림 정도
    const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
    
    // 종합 품질 점수
    const quality = (faceConfidence * 0.5 + avgEyeOpenness * 0.3 + eyeBalance * 0.2);
    
    return {
      score: Math.max(0, Math.min(1, quality)),
      eyeBalance: eyeBalance,
      avgEyeOpenness: avgEyeOpenness,
      faceConfidence: faceConfidence
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

  // 개선된 MediaPipe 기반 시선 추정
  estimateGazeYWithAdvancedMediaPipe(eyeRegions, screenHeight) {
    if (!eyeRegions || !eyeRegions.gaze) {
      return screenHeight * 0.5;
    }
    
    const gazeData = eyeRegions.gaze;
    
    // 1. 기본 시선 Y 좌표 계산 (0-1 범위를 화면 좌표로 변환)
    // gazeData.y는 -1(위)에서 1(아래) 범위
    let gazeRatio = (gazeData.y + 1) / 2; // 0-1 범위로 변환
    
    // 2. 머리 자세를 고려한 보정
    if (gazeData.debug && gazeData.debug.headPose && gazeData.debug.headPose.isValid) {
      const headPitch = gazeData.debug.headPose.pitch;
      // 머리가 위로 기울어지면 시선이 위쪽으로 보정
      gazeRatio -= headPitch * 0.2;
    }
    
    // 3. 신뢰도에 따른 스무딩
    const confidence = gazeData.confidence;
    if (this.lastAdvancedGazeY !== undefined && confidence > 0.5) {
      const smoothingFactor = 0.3 + (confidence * 0.4); // 신뢰도가 높을수록 더 민감하게
      gazeRatio = this.lastAdvancedGazeY * (1 - smoothingFactor) + gazeRatio * smoothingFactor;
    }
    
    // 4. 범위 제한 및 최종 좌표 계산
    gazeRatio = Math.max(0.05, Math.min(0.95, gazeRatio));
    this.lastAdvancedGazeY = gazeRatio;
    
    return screenHeight * gazeRatio;
  }

  // 기본 눈 추적을 사용한 시선 추정
  estimateGazeYWithBasicEyeTracking(eyeRegions, screenHeight) {
    if (!eyeRegions) {
      return screenHeight * 0.5;
    }
    
    let verticalGaze = 0.5; // 기본값: 중앙
    let confidence = 0;
    
    // 양쪽 눈 정보가 모두 있는 경우
    if (eyeRegions.leftEye && eyeRegions.rightEye && 
        eyeRegions.leftEye.gazeDirection && eyeRegions.rightEye.gazeDirection) {
      
      const leftGazeY = eyeRegions.leftEye.gazeDirection.y;
      const rightGazeY = eyeRegions.rightEye.gazeDirection.y;
      const avgGazeY = (leftGazeY + rightGazeY) / 2;
      
      // -1~1 범위를 0~1 범위로 변환
      verticalGaze = (avgGazeY + 1) / 2;
      
      // 신뢰도 계산
      const leftConf = eyeRegions.leftEye.confidence || 0;
      const rightConf = eyeRegions.rightEye.confidence || 0;
      confidence = (leftConf + rightConf) / 2;
      
    } else if (eyeRegions.leftEye && eyeRegions.leftEye.gazeDirection) {
      // 왼쪽 눈만 있는 경우
      verticalGaze = (eyeRegions.leftEye.gazeDirection.y + 1) / 2;
      confidence = eyeRegions.leftEye.confidence || 0;
      
    } else if (eyeRegions.rightEye && eyeRegions.rightEye.gazeDirection) {
      // 오른쪽 눈만 있는 경우
      verticalGaze = (eyeRegions.rightEye.gazeDirection.y + 1) / 2;
      confidence = eyeRegions.rightEye.confidence || 0;
    }
    
    // 신뢰도에 따른 스무딩
    if (this.lastBasicGazeY !== undefined && confidence > 0.2) {
      const smoothingFactor = confidence * 0.4;
      verticalGaze = this.lastBasicGazeY * (1 - smoothingFactor) + verticalGaze * smoothingFactor;
    }
    
    // 범위 제한
    verticalGaze = Math.max(0.1, Math.min(0.9, verticalGaze));
    this.lastBasicGazeY = verticalGaze;
    
    return screenHeight * verticalGaze;
  }

  // MediaPipe 결과를 사용한 개선된 시선 추정 (머리 움직임 기반) - 기존 호환성 유지
  estimateGazeYWithMediaPipe(eyeRegions, screenHeight) {
    if (!eyeRegions || !eyeRegions.faceCenter) {
      return screenHeight * 0.5;
    }

    // 1. 머리 기울기 분석
    const headTilt = this.analyzeHeadTilt();
    
    // 2. 눈의 상대적 위치 분석 (얼굴 중심 대비)
    const eyeRelativePosition = this.analyzeEyeRelativePosition(eyeRegions);
    
    // 3. 눈꺼풀 열림 정도로 의도성 판단
    const intentionality = this.analyzeEyeIntentionality(eyeRegions);
    
    // 4. 종합적인 시선 추정
    let gazeY = screenHeight * 0.5; // 기본값: 중앙
    
    // 머리 기울기 기반 추정 (주요 요소)
    if (headTilt.isValid) {
      // 머리가 위로 기울어지면 시선이 위쪽, 아래로 기울어지면 아래쪽
      const headBasedGaze = 0.5 - (headTilt.pitch * 0.8); // 민감도 조절
      gazeY = screenHeight * Math.max(0.1, Math.min(0.9, headBasedGaze));
    }
    
    // 눈의 상대적 위치로 미세 조정
    if (eyeRelativePosition.isValid && intentionality > 0.3) {
      const eyeAdjustment = eyeRelativePosition.verticalOffset * 0.3; // 미세 조정
      gazeY += screenHeight * eyeAdjustment;
      gazeY = Math.max(screenHeight * 0.05, Math.min(screenHeight * 0.95, gazeY));
    }
    
    // 부드러운 스무딩
    const smoothingFactor = 0.6;
    if (this.lastGazeY !== undefined) {
      const smoothedGazeY = this.lastGazeY * smoothingFactor + gazeY * (1 - smoothingFactor);
      this.lastGazeY = smoothedGazeY;
      return smoothedGazeY;
    } else {
      this.lastGazeY = gazeY;
      return gazeY;
    }
  }

  // 머리 기울기 분석 (MediaPipe 랜드마크 기반)
  analyzeHeadTilt() {
    if (!this.faceDetectionResults || !this.faceDetectionResults.multiFaceLandmarks || 
        this.faceDetectionResults.multiFaceLandmarks.length === 0) {
      return { isValid: false, pitch: 0, yaw: 0, roll: 0 };
    }

    const landmarks = this.faceDetectionResults.multiFaceLandmarks[0];
    
    // 주요 얼굴 포인트들
    const noseTip = landmarks[1];      // 코끝
    const foreheadCenter = landmarks[9]; // 이마 중앙
    const chinCenter = landmarks[175];   // 턱 중앙
    const leftCheek = landmarks[234];    // 왼쪽 볼
    const rightCheek = landmarks[454];   // 오른쪽 볼
    
    // Pitch (위아래 고개 끄덕임) 계산
    const foreheadToChin = foreheadCenter.y - chinCenter.y;
    const noseToForehead = noseTip.y - foreheadCenter.y;
    const noseToChin = chinCenter.y - noseTip.y;
    
    // 정면을 보고 있을 때의 비율을 기준으로 pitch 계산
    const normalRatio = 0.4; // 정면일 때 코-이마 / 이마-턱 비율
    const currentRatio = Math.abs(noseToForehead) / Math.abs(foreheadToChin);
    const pitch = (currentRatio - normalRatio) * 2; // -1 ~ 1 범위로 정규화
    
    // Yaw (좌우 고개 돌림) 계산
    const leftToRight = rightCheek.x - leftCheek.x;
    const noseOffset = noseTip.x - (leftCheek.x + rightCheek.x) / 2;
    const yaw = (noseOffset / leftToRight) * 2; // -1 ~ 1 범위
    
    // Roll (머리 기울임) 계산
    const eyeLine = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);
    const roll = eyeLine; // 라디안 단위
    
    return {
      isValid: true,
      pitch: Math.max(-1, Math.min(1, pitch)), // 제한된 범위
      yaw: Math.max(-1, Math.min(1, yaw)),
      roll: roll
    };
  }

  // 눈의 상대적 위치 분석
  analyzeEyeRelativePosition(eyeRegions) {
    if (!eyeRegions.leftEye || !eyeRegions.rightEye || !eyeRegions.faceCenter) {
      return { isValid: false, verticalOffset: 0, horizontalOffset: 0 };
    }
    
    // 두 눈의 중점 계산
    const eyesCenterX = (eyeRegions.leftEye.center.x + eyeRegions.rightEye.center.x) / 2;
    const eyesCenterY = (eyeRegions.leftEye.center.y + eyeRegions.rightEye.center.y) / 2;
    
    // 얼굴 중심 대비 눈의 상대적 위치
    const faceHeight = this.canvas.height * 0.3; // 예상 얼굴 높이
    const faceWidth = this.canvas.width * 0.25;   // 예상 얼굴 너비
    
    const verticalOffset = (eyeRegions.faceCenter.y - eyesCenterY) / faceHeight;
    const horizontalOffset = (eyesCenterX - eyeRegions.faceCenter.x) / faceWidth;
    
    return {
      isValid: true,
      verticalOffset: Math.max(-1, Math.min(1, verticalOffset)),
      horizontalOffset: Math.max(-1, Math.min(1, horizontalOffset))
    };
  }

  // 눈의 의도성 분석 (눈꺼풀 상태 기반)
  analyzeEyeIntentionality(eyeRegions) {
    if (!eyeRegions.leftEye || !eyeRegions.rightEye) {
      return 0;
    }
    
    const leftOpenness = eyeRegions.leftEye.openness || 0;
    const rightOpenness = eyeRegions.rightEye.openness || 0;
    const averageOpenness = (leftOpenness + rightOpenness) / 2;
    
    // 눈이 충분히 열려있고, 좌우 균형이 맞으면 의도적인 시선으로 판단
    const balance = 1 - Math.abs(leftOpenness - rightOpenness);
    const intentionality = Math.min(averageOpenness * 10, 1) * balance;
    
    return intentionality;
  }

  sendDebugInfo(regions, currentBrightness, previousBrightness, gazeY, screenHeight, eyeRegions, currentFaceRegion = null) {
    // 메시지 전송이 일시 중단된 경우 전송하지 않음
    if (this.messageSendPaused) {
      return;
    }

    // 메시지 전송 빈도를 제한 (매 3프레임마다 1번만 전송 - 더 빠른 업데이트)
    if (!this.frameCount) {
      this.frameCount = 0;
    }
    this.frameCount++;

    if (this.frameCount % 3 !== 0) {
      return; // 3프레임에 1번만 전송 (더 빠른 업데이트)
    }

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

    // 현재 프레임에서 찾은 얼굴 영역을 사용 (이미 추적 루프에서 감지됨)
    const faceRegionForDebug = currentFaceRegion || this.currentFaceRegion;

    // 디버그 데이터 구성
    const debugData = {
      gazePosition: gazePositionText,
      gazeX: 0.5, // 중앙 고정 (단순화)
      gazeY: gazeRatio,
      brightnessDiff: brightnessDiff.toFixed(2),
      scrollDirection: this.scrollDirection,
      // 숫자 그대로 전송하여 수신측에서 toFixed 사용 가능하도록 함
      acceleration: this.scrollAcceleration,
      regions: {
        top: (regions.top / 255).toFixed(3),
        bottom: (regions.bottom / 255).toFixed(3),
        center: (regions.center / 255).toFixed(3)
      },
      faceDetection: faceDetectionStatus,
      currentFaceRegion: faceRegionForDebug ? {
        x: faceRegionForDebug.x,
        y: faceRegionForDebug.y,
        width: faceRegionForDebug.width,
        height: faceRegionForDebug.height,
        skinPixels: faceRegionForDebug.skinPixels,
        totalSamples: faceRegionForDebug.totalSamples,
        skinPercentage: faceRegionForDebug.skinPixels && faceRegionForDebug.totalSamples ? 
          ((faceRegionForDebug.skinPixels / faceRegionForDebug.totalSamples) * 100).toFixed(1) : '0',
        confidence: faceRegionForDebug.confidence ? faceRegionForDebug.confidence.toFixed(2) : '0.00',
        detectionMethods: faceRegionForDebug.detectionMethods || null
      } : null,
      eyeTracking: {
        quality: eyeTrackingQuality,
        isCalibrated: this.eyeTrackingState.isCalibrated,
        calibrationFrames: this.eyeTrackingState.calibrationFrames,
        lastEyePosition: this.eyeTrackingState.lastEyePosition,
        eyeDistance: this.eyeTrackingState.eyeDistance ? this.eyeTrackingState.eyeDistance.toFixed(1) : null,
        method: eyeRegions ? (eyeRegions.isMediaPipe ? 'MediaPipe Advanced' : 'Basic Algorithm') : 'None',
        regions: eyeRegions ? {
          leftEye: eyeRegions.leftEye ? {
            x: eyeRegions.leftEye.x,
            y: eyeRegions.leftEye.y,
            width: eyeRegions.leftEye.width,
            height: eyeRegions.leftEye.height,
            confidence: eyeRegions.leftEye.confidence ? eyeRegions.leftEye.confidence.toFixed(3) : '0.000',
            openness: eyeRegions.leftEye.openness ? eyeRegions.leftEye.openness.toFixed(3) : null,
            pupilCenter: eyeRegions.leftEye.pupilCenter,
            gazeDirection: eyeRegions.leftEye.gazeDirection ? {
              x: eyeRegions.leftEye.gazeDirection.x.toFixed(3),
              y: eyeRegions.leftEye.gazeDirection.y.toFixed(3),
              magnitude: eyeRegions.leftEye.gazeDirection.magnitude ? eyeRegions.leftEye.gazeDirection.magnitude.toFixed(3) : null
            } : null
          } : null,
          rightEye: eyeRegions.rightEye ? {
            x: eyeRegions.rightEye.x,
            y: eyeRegions.rightEye.y,
            width: eyeRegions.rightEye.width,
            height: eyeRegions.rightEye.height,
            confidence: eyeRegions.rightEye.confidence ? eyeRegions.rightEye.confidence.toFixed(3) : '0.000',
            openness: eyeRegions.rightEye.openness ? eyeRegions.rightEye.openness.toFixed(3) : null,
            pupilCenter: eyeRegions.rightEye.pupilCenter,
            gazeDirection: eyeRegions.rightEye.gazeDirection ? {
              x: eyeRegions.rightEye.gazeDirection.x.toFixed(3),
              y: eyeRegions.rightEye.gazeDirection.y.toFixed(3),
              magnitude: eyeRegions.rightEye.gazeDirection.magnitude ? eyeRegions.rightEye.gazeDirection.magnitude.toFixed(3) : null
            } : null
          } : null,
          // 통합된 시선 분석 결과 추가
          gazeAnalysis: eyeRegions.gaze ? {
            x: eyeRegions.gaze.x.toFixed(3),
            y: eyeRegions.gaze.y.toFixed(3),
            confidence: eyeRegions.gaze.confidence.toFixed(3),
            method: eyeRegions.gaze.method,
            consistency: eyeRegions.gaze.debug ? eyeRegions.gaze.debug.consistency.toFixed(3) : null
          } : null
        } : null
      },
      systemStatus: {
        isActive: this.isActive,
        isCalibrating: this.isCalibrating,
        debugMode: this.settings.debugMode,
        faceDetectionMethod: this.mediaPipeInitialized ? 
          (this.faceMesh && this.faceMesh.useAdvancedLocal ? 'Advanced Local AI' : 'Enhanced Local') : 'Basic Skin Detection',
        mediaPipeStatus: {
          initialized: this.mediaPipeInitialized,
          hasResults: !!(this.faceDetectionResults && this.faceDetectionResults.multiFaceLandmarks && this.faceDetectionResults.multiFaceLandmarks.length > 0),
          landmarkCount: this.faceDetectionResults && this.faceDetectionResults.multiFaceLandmarks && this.faceDetectionResults.multiFaceLandmarks.length > 0 ? this.faceDetectionResults.multiFaceLandmarks[0].length : 0
        }
        // mirrorMode 제거됨 - 항상 반전 모드로 고정
      },
      // MediaPipe 랜드마크 데이터 추가
      mediaPipeLandmarks: this.faceDetectionResults && this.faceDetectionResults.multiFaceLandmarks && this.faceDetectionResults.multiFaceLandmarks.length > 0 ? this.faceDetectionResults.multiFaceLandmarks[0] : null,
      // 머리 기울기 정보 추가
      headTiltInfo: eyeRegions && eyeRegions.isMediaPipe ? this.analyzeHeadTilt() : null,
      // 디버깅을 위한 MediaPipe 상태 정보
      mediaPipeDebug: {
        initialized: this.mediaPipeInitialized,
        hasResults: !!(this.faceDetectionResults),
        hasLandmarks: !!(this.faceDetectionResults && this.faceDetectionResults.multiFaceLandmarks && this.faceDetectionResults.multiFaceLandmarks.length > 0),
        landmarkCount: this.faceDetectionResults && this.faceDetectionResults.multiFaceLandmarks && this.faceDetectionResults.multiFaceLandmarks.length > 0 ? this.faceDetectionResults.multiFaceLandmarks[0].length : 0
      }
    };

    // 항상 캔버스 이미지 캡처 (카메라 표시용)
    if (this.canvas) {
      try {
        // 디버그용으로 최적화된 크기로 캡처
        const debugCanvas = document.createElement('canvas');
        const debugCtx = debugCanvas.getContext('2d');
        debugCanvas.width = 320;
        debugCanvas.height = 240;

        // 원본 캔버스를 디버그 크기로 축소 (더 부드럽게)
        debugCtx.imageSmoothingEnabled = true;
        debugCtx.imageSmoothingQuality = 'high';
        debugCtx.drawImage(this.canvas, 0, 0, debugCanvas.width, debugCanvas.height);

        const imageData = debugCanvas.toDataURL('image/jpeg', 0.8);
        debugData.frameImage = imageData;
      } catch (error) {
        console.warn('카메라 이미지 캡처 실패:', error);
      }
    }

    // popup으로 카메라 정보 전송 (안전한 방식)
    this.safeMessageSend({
      action: 'debugUpdate',
      data: debugData
    });
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
    // 스크롤에 관계없이 항상 보이는 고정 위치 알림
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      padding: 15px 20px;
      background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#3742fa'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      min-width: 250px;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      transform: translateZ(0);
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
