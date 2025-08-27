import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [isActive, setIsActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [handGesture, setHandGesture] = useState('none');
  const [scrollDirection, setScrollDirection] = useState('none');
  const [isScrolling, setIsScrolling] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 비디오 요소 참조를 위한 콜백
  const setVideoRef = useCallback((element) => {
    videoRef.current = element;
    console.log("setVideoRef 호출됨:", element);
  }, []);

  // 카메라 권한 상태 확인
  const checkCameraPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'camera' });
        setPermissionStatus(permission.state);
        console.log("카메라 권한 상태:", permission.state);
        
        // 권한 상태 변경 감지
        permission.onchange = () => {
          setPermissionStatus(permission.state);
          console.log("카메라 권한 상태 변경:", permission.state);
        };
      } else {
        setPermissionStatus('not-supported');
        console.log("권한 API를 지원하지 않습니다");
      }
    } catch (err) {
      console.error("권한 확인 오류:", err);
      setPermissionStatus('error');
    }
  };

  // MediaPipe Hands 초기화
  const initializeMediaPipe = async () => {
    try {
      console.log("MediaPipe Hands 초기화 시작...");
      
      if (!window.Hands) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js";
        script.onload = () => {
          console.log("MediaPipe Hands 스크립트 로드 완료");
          setMediaPipeLoaded(true);
        };
        script.onerror = () => {
          console.error("MediaPipe Hands 스크립트 로드 실패");
          setError("MediaPipe Hands 로드 실패");
        };
        document.head.appendChild(script);
      } else {
        console.log("MediaPipe Hands 이미 로드됨");
        setMediaPipeLoaded(true);
      }
    } catch (err) {
      console.error("MediaPipe 초기화 오류:", err);
      setError("MediaPipe 초기화 실패: " + err.message);
    }
  };

  // 컴포넌트 마운트 시 권한 확인 및 MediaPipe 초기화
  useEffect(() => {
    checkCameraPermission();
    initializeMediaPipe();
  }, []);

  // isActive가 true가 될 때 카메라 초기화
  useEffect(() => {
    if (isActive && videoRef.current) {
      console.log("useEffect에서 카메라 초기화 시작");
      initializeCamera();
    }
  }, [isActive]);

  // MediaPipe가 로드되고 카메라가 활성화되면 손 인식 시작
  useEffect(() => {
    if (mediaPipeLoaded && isCameraActive && videoRef.current && canvasRef.current) {
      console.log("MediaPipe 로드 완료, 손 인식 시작");
      setTimeout(() => {
        startHandDetection();
      }, 500); // 약간의 지연 후 시작
    }
  }, [mediaPipeLoaded, isCameraActive]);

  // 카메라 초기화
  const initializeCamera = async () => {
    try {
      console.log("카메라 초기화 시작...");
      console.log("videoRef.current:", videoRef.current);
      
      // 카메라 권한 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("이 브라우저는 카메라를 지원하지 않습니다");
      }

      // 비디오 요소가 준비될 때까지 대기
      let attempts = 0;
      const maxAttempts = 20; // 더 많은 시도
      
      while (!videoRef.current && attempts < maxAttempts) {
        console.log(`비디오 요소 대기 중... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 50)); // 더 짧은 간격
        attempts++;
      }

      if (!videoRef.current) {
        console.error("videoRef.current가 여전히 null입니다");
        console.error("DOM 구조:", document.querySelector('video'));
        throw new Error("비디오 요소를 찾을 수 없습니다. DOM이 아직 준비되지 않았습니다.");
      }

      console.log("비디오 요소 찾음:", videoRef.current);
      console.log("getUserMedia 호출 중...");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      });

      console.log("카메라 스트림 획득 성공:", stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);
        console.log("카메라 활성화 완료");
      } else {
        throw new Error("비디오 요소가 초기화 중에 사라졌습니다");
      }
    } catch (err) {
      console.error("카메라 초기화 오류:", err);
      
      let errorMessage = "카메라 접근 실패";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "카메라가 다른 애플리케이션에서 사용 중입니다.";
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = "지원하지 않는 카메라 설정입니다.";
      } else {
        errorMessage = `카메라 오류: ${err.message}`;
      }
      
      setError(errorMessage);
      setIsCameraActive(false);
    }
  };

  // 손 인식 및 제스처 감지
  const startHandDetection = () => {
    console.log("startHandDetection 호출됨");
    console.log("조건 확인:", {
      videoRef: !!videoRef.current,
      canvasRef: !!canvasRef.current,
      Hands: !!window.Hands,
      mediaPipeLoaded: mediaPipeLoaded,
      isCameraActive: isCameraActive
    });

    if (!videoRef.current || !canvasRef.current || !window.Hands) {
      console.log("손 인식 시작 조건 미충족");
      return;
    }

    console.log("손 인식 시작...");
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // MediaPipe Hands 초기화
    const hands = new window.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      console.log("MediaPipe 결과:", results);
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log("손 감지됨, 랜드마크 개수:", results.multiHandLandmarks.length);
        const landmarks = results.multiHandLandmarks[0];
        
        // 손가락 상태 감지
        const handState = detectHandState(landmarks);
        console.log("손 상태:", handState);
        
        if (handState === 'open' || handState === 'closed') {
          setHandDetected(true);
          
          // 손 위치에 따른 제스처 감지 (손이 열려있을 때만)
          let gesture = "none";
          if (handState === 'open') {
            const handPosition = getHandPosition(landmarks, canvas.width, canvas.height);
            gesture = detectGesture(handPosition, canvas.height);
          } else if (handState === 'closed') {
            // 손이 닫혀있으면 위로 스크롤
            gesture = "up";
          }
          
          console.log("손 위치 기반 제스처:", gesture);
          
          setHandGesture(gesture);
          setScrollDirection(gesture);
          
          // 제스처에 따른 스크롤 제어
          handleScroll(gesture);
          
          // 손 랜드마크 그리기
          drawHandLandmarks(ctx, landmarks, canvas.width, canvas.height);
        } else {
          console.log("손이 부분적으로 열려있음 - 무시");
          setHandDetected(false);
          setHandGesture("none");
          setScrollDirection("none");
          setIsScrolling(false);
        }
      } else {
        console.log("손이 감지되지 않음");
        setHandDetected(false);
        setHandGesture("none");
        setScrollDirection("none");
        setIsScrolling(false);
      }
    });

    // 비디오 프레임 처리
    const processFrame = async () => {
      if (!isActive || !video.videoWidth) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      await hands.send({ image: canvas });
      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  // 손가락 상태 감지 (펴짐/접힘)
  const detectHandState = (landmarks) => {
    const fingerTips = [4, 8, 12, 16, 20]; // 엄지, 검지, 중지, 약지, 새끼 손가락 끝
    const fingerPips = [3, 6, 10, 14, 18]; // 손가락 중간 관절
    
    let openFingers = 0;
    const fingerNames = ['엄지', '검지', '중지', '약지', '새끼'];
    
    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPips[i]];
      
      let isOpen = false;
      if (i === 0) { // 엄지
        isOpen = tip.x < pip.x;
      } else { // 나머지 손가락
        isOpen = tip.y < pip.y;
      }
      
      if (isOpen) {
        openFingers++;
        console.log(`${fingerNames[i]} 손가락이 펴져있음`);
      } else {
        console.log(`${fingerNames[i]} 손가락이 접혀있음`);
      }
    }
    
    console.log(`총 ${openFingers}개 손가락이 펴져있음`);
    
    // 손 상태 반환: 'open' (4개 이상 펴짐), 'closed' (모두 접힘), 'partial' (부분적)
    if (openFingers >= 4) {
      return 'open';
    } else if (openFingers === 0) {
      return 'closed';
    } else {
      return 'partial';
    }
  };

  // 손 위치 계산
  const getHandPosition = (landmarks, canvasWidth, canvasHeight) => {
    const palmCenter = landmarks[0]; // 손바닥 중앙점
    return {
      x: palmCenter.x * canvasWidth,
      y: palmCenter.y * canvasHeight,
    };
  };

  // 제스처 감지
  const detectGesture = (handPosition, canvasHeight) => {
    const centerY = canvasHeight / 2;
    const threshold = 80; // 감지 임계값
    
    if (handPosition.y < centerY - threshold) {
      return "up";
    } else if (handPosition.y > centerY + threshold) {
      return "down";
    } else {
      return "center";
    }
  };

  // 스크롤 제어
  const handleScroll = (gesture) => {
    if (gesture === "down") {
      setIsScrolling(true);
      window.scrollBy({ top: 50, behavior: "smooth" });
    } else if (gesture === "up") {
      setIsScrolling(true);
      window.scrollBy({ top: -100, behavior: "smooth" });
    } else {
      setIsScrolling(false);
    }
  };

  // 손 랜드마크 그리기
  const drawHandLandmarks = (ctx, landmarks, canvasWidth, canvasHeight) => {
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#00ff00";

    // 손바닥 중앙점
    const palmCenter = landmarks[0];
    ctx.beginPath();
    ctx.arc(
      palmCenter.x * canvasWidth,
      palmCenter.y * canvasHeight,
      8,
      0,
      2 * Math.PI
    );
    ctx.fill();

    // 손가락 끝점들 연결
    const connections = [
      [0, 1, 2, 3, 4], // 엄지
      [0, 5, 6, 7, 8], // 검지
      [0, 9, 10, 11, 12], // 중지
      [0, 13, 14, 15, 16], // 약지
      [0, 17, 18, 19, 20], // 새끼
    ];

    connections.forEach((finger) => {
      for (let i = 0; i < finger.length - 1; i++) {
        const start = landmarks[finger[i]];
        const end = landmarks[finger[i + 1]];

        ctx.beginPath();
        ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
        ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);
        ctx.stroke();
      }
    });

    // 손가락 끝점 강조
    const fingerTips = [4, 8, 12, 16, 20];
    fingerTips.forEach((tipIndex) => {
      const tip = landmarks[tipIndex];
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(
        tip.x * canvasWidth,
        tip.y * canvasHeight,
        4,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
  };

  // 활성화 버튼 클릭 시 카메라 시작
  const handleToggle = () => {
    if (!isActive) {
      setIsActive(true);
      // useRef가 준비될 때까지 잠시 대기
      setTimeout(() => {
        console.log("handleToggle에서 videoRef 확인:", videoRef.current);
        if (videoRef.current) {
          console.log("videoRef가 준비됨, 카메라 초기화 시작");
          initializeCamera();
        } else {
          console.error("videoRef가 여전히 준비되지 않음");
        }
      }, 100);
    } else {
      setIsActive(false);
      setIsCameraActive(false);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">GazeScroll</h1>
          <p className="text-gray-600">손 제스처로 스크롤을 제어하는 시스템</p>
          
          {/* 활성화 버튼 */}
          <button
            onClick={handleToggle}
            className={`mt-4 px-6 py-3 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isActive ? '비활성화' : '활성화'}
          </button>
        </div>

        {/* 상태 표시 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">시스템 상태</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                isActive ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <p className="text-sm text-gray-600">
                {isActive ? '활성화됨' : '비활성화됨'}
              </p>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                isCameraActive ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
              <p className="text-sm text-gray-600">
                {isCameraActive ? '카메라 활성' : '카메라 준비'}
              </p>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                permissionStatus === 'granted' ? 'bg-green-500' : 
                permissionStatus === 'denied' ? 'bg-red-500' : 
                permissionStatus === 'prompt' ? 'bg-yellow-500' : 'bg-gray-400'
              }`}></div>
              <p className="text-sm text-gray-600">
                {permissionStatus === 'granted' ? '권한 허용' :
                 permissionStatus === 'denied' ? '권한 거부' :
                 permissionStatus === 'prompt' ? '권한 요청' :
                 permissionStatus === 'not-supported' ? '권한 API 없음' :
                 permissionStatus === 'error' ? '권한 오류' : '권한 확인 중'}
              </p>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                mediaPipeLoaded ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              <p className="text-sm text-gray-600">
                {mediaPipeLoaded ? 'MediaPipe 로드됨' : 'MediaPipe 로딩 중'}
              </p>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                handDetected ? 'bg-green-500' : 'bg-yellow-400'
              }`}></div>
              <p className="text-sm text-gray-600">
                {handDetected ? '손 감지됨' : '손 감지 중...'}
              </p>
            </div>
          </div>
          
          {/* 권한 상태 상세 정보 */}
          <div className="mt-4 p-3 bg-gray-50 rounded border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">카메라 권한 상태</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <div>현재 상태: <strong>{permissionStatus}</strong></div>
              {permissionStatus === 'denied' && (
                <div className="text-red-600">
                  브라우저 설정에서 카메라 권한을 허용해주세요.
                </div>
              )}
              {permissionStatus === 'prompt' && (
                <div className="text-yellow-600">
                  활성화 버튼을 클릭하면 권한 요청이 나타납니다.
                </div>
              )}
              <button
                onClick={checkCameraPermission}
                className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
              >
                권한 상태 새로고침
              </button>
            </div>
          </div>
        </div>

        {/* 카메라 뷰 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">카메라 뷰</h2>
          
          {error ? (
            <div className="text-center py-8">
              <div className="text-red-600 font-medium mb-2">오류 발생</div>
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={initializeCamera}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="relative bg-black rounded-lg overflow-hidden">
              {/* 비디오 요소를 항상 렌더링하되 조건부로 표시 */}
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain bg-black ${isCameraActive ? 'block' : 'hidden'}`}
              />
              
              {/* 손 인식 오버레이 캔버스 */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
              />
              
              {/* 카메라가 활성화되지 않았을 때 표시할 내용 */}
              {!isCameraActive && (
                <div className="w-full h-48 flex items-center justify-center bg-gray-800">
                  <div className="text-center text-white">
                    <div className="text-lg mb-2">📹</div>
                    <div className="text-sm">
                      {isActive ? '카메라 연결 중...' : '카메라 비활성화됨'}
                    </div>
                  </div>
                </div>
              )}
              
              {/* 카메라 활성 상태 표시 */}
              {isCameraActive && (
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  카메라 활성 ✅
                </div>
              )}
              
                        {/* 손 인식 상태 표시 */}
          {isCameraActive && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              <div>손: {handDetected ? '✅' : '⏳'}</div>
              <div>제스처: {handGesture === 'up' ? '⬆️ 위로' : handGesture === 'down' ? '⬇️ 아래로' : handGesture === 'center' ? '➡️ 정면' : '⏸️ 없음'}</div>
            </div>
          )}
              
              {/* 스크롤 방향 표시 */}
              {isCameraActive && scrollDirection !== 'none' && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  {scrollDirection === 'down' && '⬇️ 아래로 스크롤'}
                  {scrollDirection === 'up' && '⬆️ 위로 스크롤'}
                  {scrollDirection === 'center' && '➡️ 대기 중'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 손 제스처 상태 */}
        {isActive && (
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">손 제스처 상태</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                  handDetected ? 'bg-green-500' : 'bg-yellow-400'
                }`}></div>
                <p className="text-sm text-green-700">
                  {handDetected ? '손 감지됨' : '손 감지 중...'}
                </p>
              </div>
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                  handGesture !== 'none' ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <p className="text-sm text-green-700">
                  {handGesture === 'up' && '⬆️ 위로 (손 접힘)'}
                  {handGesture === 'down' && '⬇️ 아래로 (손 펴짐)'}
                  {handGesture === 'center' && '➡️ 정면 (손 펴짐)'}
                  {handGesture === 'none' && '⏸️ 없음'}
                </p>
              </div>
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                  isScrolling ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <p className="text-sm text-green-700">
                  {isScrolling ? '스크롤 중...' : '대기 중'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 간단한 테스트 컨텐츠 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">테스트 컨텐츠</h2>
          <p className="text-gray-600 mb-4">
            이 페이지가 정상적으로 렌더링되면 기본 React 앱은 작동하는 것입니다.
            {isActive && isCameraActive && " 카메라도 정상적으로 연결되었습니다!"}
            {handDetected && " 손 인식도 활성화되었습니다!"}
          </p>
          
          <div className="space-y-2">
            <div className="h-20 bg-blue-100 rounded p-4">
              <p className="text-blue-800">테스트 블록 1</p>
            </div>
            <div className="h-20 bg-green-100 rounded p-4">
              <p className="text-green-800">테스트 블록 2</p>
            </div>
            <div className="h-20 bg-purple-100 rounded p-4">
              <p className="text-purple-800">테스트 블록 3</p>
            </div>
            <div className="h-20 bg-yellow-100 rounded p-4">
              <p className="text-yellow-800">테스트 블록 4</p>
            </div>
            <div className="h-20 bg-red-100 rounded p-4">
              <p className="text-red-800">테스트 블록 5</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
