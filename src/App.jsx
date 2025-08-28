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
  const [isCameraFloating, setIsCameraFloating] = useState(false);
  const [lastGesture, setLastGesture] = useState('none');
  const [gestureCount, setGestureCount] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const floatingVideoRef = useRef(null);
  const floatingCanvasRef = useRef(null);

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

  // 플로팅 카메라 활성화 시 스트림 복사
  useEffect(() => {
    if (isCameraFloating && isCameraActive && videoRef.current && floatingVideoRef.current) {
      const mainStream = videoRef.current.srcObject;
      if (mainStream) {
        floatingVideoRef.current.srcObject = mainStream;
      }
    }
  }, [isCameraFloating, isCameraActive]);

  // MediaPipe가 로드되고 카메라가 활성화되면 손 인식 시작
  useEffect(() => {
    console.log("MediaPipe 상태 체크:", { 
      mediaPipeLoaded, 
      isCameraActive, 
      hasVideo: !!videoRef.current, 
      hasCanvas: !!canvasRef.current 
    });
    
    if (mediaPipeLoaded && isCameraActive && videoRef.current && canvasRef.current) {
      console.log("MediaPipe 로드 완료, 손 인식 시작");
      setTimeout(() => {
        startHandDetection();
      }, 1000); // 더 긴 지연 후 시작
    }
  }, [mediaPipeLoaded, isCameraActive]);

    // 플로팅 창에서도 손 인식 오버레이 업데이트
  useEffect(() => {
    if (isCameraFloating && isCameraActive && floatingCanvasRef.current && canvasRef.current) {
      const updateFloatingCanvas = () => {
        const mainCanvas = canvasRef.current;
        const floatingCanvas = floatingCanvasRef.current;
        if (mainCanvas && floatingCanvas && mainCanvas.width > 0) {
          const floatingContext = floatingCanvas.getContext('2d');
          
          // 고해상도로 설정하여 선명도 향상
          const devicePixelRatio = window.devicePixelRatio || 1;
          const rect = floatingCanvas.getBoundingClientRect();
          
          floatingCanvas.width = rect.width * devicePixelRatio;
          floatingCanvas.height = rect.height * devicePixelRatio;
          floatingCanvas.style.width = rect.width + 'px';
          floatingCanvas.style.height = rect.height + 'px';
          
          floatingContext.scale(devicePixelRatio, devicePixelRatio);
          
          // 메인 캔버스의 내용을 플로팅 캔버스에 복사
          floatingContext.drawImage(mainCanvas, 0, 0, rect.width, rect.height);
        }
      };
      
      // requestAnimationFrame을 사용하여 더 부드러운 업데이트
      let animationId;
      const animate = () => {
        updateFloatingCanvas();
        animationId = requestAnimationFrame(animate);
      };
      animate();
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }
  }, [isCameraFloating, isCameraActive]);

  // 카메라가 화면 밖으로 나가면 자동으로 작게 만들기
  useEffect(() => {
    const checkCameraVisibility = () => {
      const cameraElement = document.querySelector('.fixed.top-4.right-4');
      if (cameraElement && isCameraActive) {
        const rect = cameraElement.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        
        if (!isVisible && !isCameraFloating) {
          setIsCameraFloating(true);
          console.log("카메라가 화면 밖으로 나가서 자동으로 작게 변경");
        }
      }
    };

    window.addEventListener('scroll', checkCameraVisibility);
    window.addEventListener('resize', checkCameraVisibility);
    
    return () => {
      window.removeEventListener('scroll', checkCameraVisibility);
      window.removeEventListener('resize', checkCameraVisibility);
    };
  }, [isCameraFloating, isCameraActive]);

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
      modelComplexity: 1, // 안정성을 위해 다시 1로 변경
      minDetectionConfidence: 0.5, // 적당한 임계값으로 조정
      minTrackingConfidence: 0.5, // 적당한 임계값으로 조정
    });

    hands.onResults((results) => {
      console.log("MediaPipe 결과:", results);
      console.log("랜드마크 개수:", results.multiHandLandmarks?.length || 0);
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log("손 감지됨, 랜드마크 개수:", results.multiHandLandmarks.length);
        const landmarks = results.multiHandLandmarks[0];
        
        // 손가락 상태 감지
        const handState = detectHandState(landmarks);
        console.log("손 상태:", handState);
        
        if (handState !== 'partial') {
          setHandDetected(true);
          
          // 손 위치에 따른 제스처 감지
          let gesture = "none";
          
          if (handState === 'open_palm') {
            // 손바닥 펴기 - 손바닥 방향에 따라 위/아래
            gesture = detectGesture(landmarks);
          } else if (handState === 'closed') {
            // 손이 닫혀있으면 위로 스크롤
            gesture = "up";
          } else if (handState === 'two_finger_touch') {
            // 두 손가락 터치 - 아래로 스크롤
            gesture = "two_finger_touch";
          } else if (handState === 'index_only' || handState === 'index') {
            // 검지 한 손가락 - 빠른 스크롤
            gesture = "index_fast_down";
          } else if (handState === 'middle_only' || handState === 'middle') {
            // 중지 한 손가락 - 위로 스크롤
            gesture = "middle_up";
          } else if (handState === 'ring_only' || handState === 'ring') {
            // 약지 한 손가락 - 아래로 스크롤
            gesture = "ring_down";
          } else if (handState === 'pinky_only' || handState === 'pinky') {
            // 새끼 한 손가락 - 빠른 위로
            gesture = "pinky_fast_up";
          } else if (handState === 'thumb_only' || handState === 'thumb') {
            // 엄지 한 손가락 - 탑으로 이동
            gesture = "thumb_top";
          } else if (handState === 'index_middle' || handState === 'peace') {
            // 검지+중지 (평화) - 빠른 아래로
            gesture = "peace_fast_down";
          } else if (handState === 'index_ring') {
            // 검지+약지 - 빠른 위로
            gesture = "index_ring_fast_up";
          } else if (handState === 'index_pinky' || handState === 'rock') {
            // 검지+새끼 (락) - 빠른 위로
            gesture = "rock_fast_up";
          } else if (handState === 'middle_ring') {
            // 중지+약지 - 중간 속도 위로
            gesture = "middle_ring_up";
          } else if (handState === 'middle_pinky') {
            // 중지+새끼 - 중간 속도 아래로
            gesture = "middle_pinky_down";
          } else if (handState === 'ring_pinky') {
            // 약지+새끼 - 매우 빠른 아래로
            gesture = "ring_pinky_very_fast_down";
          } else if (handState === 'three') {
            // 검지+중지+약지 - 매우 빠른 위로
            gesture = "three_very_fast_up";
          } else if (handState === 'four') {
            // 검지+중지+약지+새끼 - 끝으로 이동
            gesture = "four_bottom";
          }
          
          console.log("손 위치 기반 제스처:", gesture);
          
          // 제스처 안정성을 위한 디바운싱
          if (gesture === lastGesture) {
            setGestureCount(prev => prev + 1);
          } else {
            setGestureCount(1);
            setLastGesture(gesture);
          }
          
          // 같은 제스처가 2번 연속 감지되면 실행 (더 빠른 반응)
          if (gestureCount >= 2 || gesture === 'none') {
            setHandGesture(gesture);
            setScrollDirection(gesture);
            
            // 제스처에 따른 스크롤 제어
            if (gesture !== 'none') {
              handleScroll(gesture);
            }
          }
          
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
        console.log("손이 감지되지 않음 - 랜드마크 없음");
        setHandDetected(false);
        setHandGesture("none");
        setScrollDirection("none");
        setIsScrolling(false);
      }
    });

    // 비디오 프레임 처리
    const processFrame = async () => {
      if (!isActive || !video.videoWidth) {
        console.log("프레임 처리 중단:", { isActive, videoWidth: video.videoWidth });
        return;
      }
      
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        await hands.send({ image: canvas });
      } catch (error) {
        console.error("프레임 처리 오류:", error);
      }
      
      requestAnimationFrame(processFrame);
    };

    console.log("손 인식 시작 - 프레임 처리 시작");
    processFrame();
  };

  // 손가락 상태 감지 및 다양한 제스처 감지
  const detectHandState = (landmarks) => {
    const fingerTips = [4, 8, 12, 16, 20]; // 엄지, 검지, 중지, 약지, 새끼 손가락 끝
    const fingerPips = [3, 6, 10, 14, 18]; // 손가락 중간 관절
    const fingerMcps = [2, 5, 9, 13, 17]; // 손가락 기저부
    
    let openFingers = 0;
    const fingerNames = ['엄지', '검지', '중지', '약지', '새끼'];
    let fingerStates = [false, false, false, false, false];
    
    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPips[i]];
      const mcp = landmarks[fingerMcps[i]];
      
      let isOpen = false;
      if (i === 0) { // 엄지 - 더 정확한 감지
        // 엄지는 x축 방향으로 펴지는지 확인
        const thumbOpen = tip.x < pip.x + 0.01;
        const thumbExtended = Math.abs(tip.x - mcp.x) > 0.05;
        isOpen = thumbOpen && thumbExtended;
      } else { // 나머지 손가락 - y축 방향으로 펴지는지 확인
        // 손가락이 펴져있는지 확인 (끝이 중간 관절보다 위에 있음)
        const fingerOpen = tip.y < pip.y + 0.03;
        // 손가락이 충분히 펴져있는지 확인 (끝이 기저부보다 위에 있음)
        const fingerExtended = tip.y < mcp.y + 0.05;
        isOpen = fingerOpen && fingerExtended;
      }
      
      if (isOpen) {
        openFingers++;
        fingerStates[i] = true;
        console.log(`${fingerNames[i]} 손가락이 펴져있음`);
      } else {
        fingerStates[i] = false;
        console.log(`${fingerNames[i]} 손가락이 접혀있음`);
      }
    }
    
    console.log(`총 ${openFingers}개 손가락이 펴져있음`);
    
    // 터치 감지 - 손가락 끝이 화면 중앙에 가까운지 확인
    const isTouching = detectTouch(landmarks);
    
    // 다양한 제스처 패턴 감지 (더 정확한 매칭)
    const patterns = {
      // 한 손가락 제스처들
      index_only: [false, true, false, false, false], // 검지만
      middle_only: [false, false, true, false, false], // 중지만
      ring_only: [false, false, false, true, false], // 약지만
      pinky_only: [false, false, false, false, true], // 새끼만
      thumb_only: [true, false, false, false, false], // 엄지만
      
      // 두 손가락 제스처들 (주요 개선 대상)
      index_middle: [false, true, true, false, false], // 검지+중지 (평화)
      index_ring: [false, true, false, true, false], // 검지+약지
      index_pinky: [false, true, false, false, true], // 검지+새끼
      middle_ring: [false, false, true, true, false], // 중지+약지
      middle_pinky: [false, false, true, false, true], // 중지+새끼
      ring_pinky: [false, false, false, true, true], // 약지+새끼
      
      // 특수 제스처들
      peace: [false, true, true, false, false], // 검지+중지 (평화)
      rock: [false, true, false, false, true], // 검지+새끼 (락)
      three: [false, true, true, true, false], // 검지+중지+약지
      four: [false, true, true, true, true], // 검지+중지+약지+새끼
    };
    
    // 제스처 패턴 매칭 (더 정확한 매칭)
    for (const [gesture, pattern] of Object.entries(patterns)) {
      const matchCount = fingerStates.filter((state, i) => state === pattern[i]).length;
      const requiredMatches = pattern.filter(Boolean).length;
      const totalMatches = fingerStates.filter(Boolean).length;
      
      // 주요 손가락들이 일치하고 총 펴진 손가락 수가 정확히 일치하면 매칭
      if (matchCount === requiredMatches && totalMatches === requiredMatches) {
        // 터치 상태와 결합하여 최종 제스처 결정
        if (isTouching && (gesture === 'index_middle' || gesture === 'peace')) {
          return 'two_finger_touch'; // 두 손가락 터치
        }
        return gesture;
      }
    }
    
    // 기본 상태 반환
    if (openFingers >= 4) {
      return 'open_palm'; // 손바닥 펴기
    } else if (openFingers === 0) {
      return 'closed'; // 손 접기
    } else if (openFingers === 2) {
      // 두 손가락이 펴진 경우 - 가장 간단한 조합들
      if (fingerStates[1] && fingerStates[2]) {
        return isTouching ? 'two_finger_touch' : 'index_middle';
      }
      if (fingerStates[1] && fingerStates[3]) return 'index_ring';
      if (fingerStates[1] && fingerStates[4]) return 'index_pinky';
      if (fingerStates[2] && fingerStates[3]) return 'middle_ring';
      if (fingerStates[2] && fingerStates[4]) return 'middle_pinky';
      if (fingerStates[3] && fingerStates[4]) return 'ring_pinky';
    } else if (openFingers === 1) {
      // 한 손가락만 펴진 경우
      for (let i = 0; i < 5; i++) {
        if (fingerStates[i]) {
          return `${['thumb', 'index', 'middle', 'ring', 'pinky'][i]}_only`;
        }
      }
    }
    
    return 'partial'; // 부분적
  };

  // 터치 감지 - 손가락 끝이 화면 중앙에 가까운지 확인
  const detectTouch = (landmarks) => {
    // 검지와 중지 손가락 끝의 위치 확인
    const indexTip = landmarks[8]; // 검지 끝
    const middleTip = landmarks[12]; // 중지 끝
    
    // 손가락 끝이 화면 중앙 영역에 있는지 확인 (y 좌표가 0.3~0.7 범위)
    const isInCenterY = (indexTip.y >= 0.3 && indexTip.y <= 0.7) && 
                       (middleTip.y >= 0.3 && middleTip.y <= 0.7);
    
    // 손가락이 충분히 펴져있는지 확인
    const indexExtended = indexTip.y < landmarks[6].y + 0.02; // 검지 중간 관절보다 위
    const middleExtended = middleTip.y < landmarks[10].y + 0.02; // 중지 중간 관절보다 위
    
    // 터치 조건: 중앙 영역에 있고, 두 손가락이 펴져있음
    const isTouching = isInCenterY && indexExtended && middleExtended;
    
    if (isTouching) {
      console.log("터치 감지됨! 두 손가락이 화면 중앙에 펴져있음");
    }
    
    return isTouching;
  };



  // 제스처 감지 - 손바닥 방향 감지
  const detectGesture = (landmarks) => {
    // 손바닥이 위를 향하는지 아래를 향하는지 감지
    // 엄지와 새끼 손가락의 위치로 판단
    const thumbTip = landmarks[4]; // 엄지 끝
    const pinkyTip = landmarks[20]; // 새끼 손가락 끝
    
    // 손바닥 방향 감지 (손바닥이 위를 향하면 thumbTip.y < pinkyTip.y)
    const palmUp = thumbTip.y < pinkyTip.y;
    
    // 손바닥이 펴진 상태: 뒤집으면 올리고, 안 뒤집으면 내리기
    if (palmUp) {
      return "up"; // 손바닥이 위를 향하면 위로
    } else {
      return "down"; // 손바닥이 아래를 향하면 아래로
    }
  };

  // 스크롤 제어 - 다양한 제스처 처리
  const handleScroll = (gesture) => {
    setIsScrolling(true);
    
    switch (gesture) {
      case "down":
        window.scrollBy({ top: 300, behavior: "smooth" });
        break;
      case "up":
        window.scrollBy({ top: -500, behavior: "smooth" });
        break;
        
      // 두 손가락 터치 제스처 (새로 추가)
      case "two_finger_touch":
        window.scrollBy({ top: 400, behavior: "smooth" });
        console.log("두 손가락 터치 감지! 아래로 스크롤");
        break;
        
      // 한 손가락 제스처들
      case "index_fast_down":
        window.scrollBy({ top: 600, behavior: "smooth" });
        break;
      case "middle_up":
        window.scrollBy({ top: -400, behavior: "smooth" });
        break;
      case "ring_down":
        window.scrollBy({ top: 500, behavior: "smooth" });
        break;
      case "pinky_fast_up":
        window.scrollBy({ top: -800, behavior: "smooth" });
        break;
      case "thumb_top":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
        
      // 두 손가락 제스처들
      case "peace_fast_down":
        window.scrollBy({ top: 800, behavior: "smooth" });
        break;
      case "index_ring_fast_up":
        window.scrollBy({ top: -900, behavior: "smooth" });
        break;
      case "rock_fast_up":
        window.scrollBy({ top: -1000, behavior: "smooth" });
        break;
      case "middle_ring_up":
        window.scrollBy({ top: -600, behavior: "smooth" });
        break;
      case "middle_pinky_down":
        window.scrollBy({ top: 700, behavior: "smooth" });
        break;
      case "ring_pinky_very_fast_down":
        window.scrollBy({ top: 1200, behavior: "smooth" });
        break;
        
      // 세 손가락 이상 제스처들
      case "three_very_fast_up":
        window.scrollBy({ top: -1500, behavior: "smooth" });
        break;
      case "four_bottom":
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        break;
        
      default:
        setIsScrolling(false);
        break;
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
        <div className={`bg-white rounded-lg shadow-sm p-6 mb-6 ${isCameraFloating ? 'h-0 overflow-hidden' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">카메라 뷰</h2>
            {isCameraActive && (
              <button
                onClick={() => setIsCameraFloating(!isCameraFloating)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
              >
                {isCameraFloating ? '크게' : '작게'}
              </button>
            )}
          </div>
          
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
                        <div className="relative bg-black rounded-lg overflow-hidden h-96">
              {/* 비디오 요소를 항상 렌더링 */}
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain bg-black ${isCameraActive ? 'block' : 'hidden'}`}
                style={{
                  transform: 'scaleX(-1)' // 좌우 반전으로 미러링 효과
                }}
              />
              
              {/* 손 인식 오버레이 캔버스 */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
                style={{
                  transform: 'scaleX(-1)' // 비디오와 같은 방향으로 미러링
                }}
              />
              
              {/* 카메라가 활성화되지 않았을 때 표시할 내용 */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
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
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                <div>손: {handDetected ? '✅' : '⏳'}</div>
                <div>제스처: {handGesture === 'up' ? '⬆️ 위로' : 
                               handGesture === 'down' ? '⬇️ 아래로' : 
                               handGesture === 'center' ? '➡️ 정면' : 
                               handGesture === 'two_finger_touch' ? '✌️ 두손가락 터치' : '⏸️ 없음'}</div>
              </div>
              
              {/* 스크롤 방향 표시 */}
              {scrollDirection !== 'none' && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  {scrollDirection === 'down' && '⬇️ 아래로 스크롤 (손 펴짐)'}
                  {scrollDirection === 'up' && '⬆️ 위로 스크롤 (손 접힘)'}
                  {scrollDirection === 'center' && '➡️ 대기 중 (손 펴짐)'}
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
                  {handGesture === 'two_finger_touch' && '✌️ 두손가락 터치'}
                  {handGesture === 'index_up' && '👆 한손가락 위로 (700px)'}
                  {handGesture === 'index_down' && '👆 한손가락 아래로 (600px)'}
                  {handGesture === 'index_center' && '👆 한손가락 아래로 (600px)'}
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

        {/* 제스처 도움말 */}
        <div className="bg-blue-50 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">✋ 손 제스처 도움말</h2>
          <p className="text-blue-700 mb-4">
            손 제스처로 웹페이지를 스크롤할 수 있습니다. 카메라 앞에서 다양한 손 모양을 만들어보세요!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 기본 제스처 */}
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-3">🖐️ 기본 제스처</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">손바닥 펴기 (위쪽):</span>
                  <span>⬆️ 위로 스크롤 (500px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">손바닥 펴기 (아래쪽):</span>
                  <span>⬇️ 아래로 스크롤 (300px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">손 접기:</span>
                  <span>⬆️ 위로 스크롤 (500px)</span>
                </div>
              </div>
            </div>

            {/* 한 손가락 제스처 */}
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-3">👆 한 손가락 제스처</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지만:</span>
                  <span>⬇️ 빠른 아래 (600px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">중지만:</span>
                  <span>⬆️ 위로 (400px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">약지만:</span>
                  <span>⬇️ 아래로 (500px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">새끼만:</span>
                  <span>⬆️ 빠른 위 (800px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">엄지만:</span>
                  <span>⬆️ 맨 위로 이동</span>
                </div>
              </div>
            </div>

            {/* 두 손가락 제스처 */}
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-3">✌️ 두 손가락 제스처</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+중지 (평화):</span>
                  <span>⬇️ 빠른 아래 (800px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+중지 터치:</span>
                  <span>⬇️ 아래로 (400px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+약지:</span>
                  <span>⬆️ 빠른 위 (900px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+새끼 (락):</span>
                  <span>⬆️ 빠른 위 (1000px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">중지+약지:</span>
                  <span>⬆️ 위로 (600px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">중지+새끼:</span>
                  <span>⬇️ 아래로 (700px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">약지+새끼:</span>
                  <span>⬇️ 매우 빠른 아래 (1200px)</span>
                </div>
              </div>
            </div>

            {/* 세 손가락 이상 제스처 */}
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-3">🤟 세 손가락 이상 제스처</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+중지+약지:</span>
                  <span>⬆️ 매우 빠른 위 (1500px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">검지+중지+약지+새끼:</span>
                  <span>⬇️ 맨 아래로 이동</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-100 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">💡 사용 팁</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 카메라 앞에서 손을 명확하게 보이도록 하세요</li>
              <li>• 손가락을 충분히 펴서 제스처를 명확하게 만드세요</li>
              <li>• 두 손가락 터치는 화면 중앙 영역에서 해야 합니다</li>
              <li>• 제스처가 안정적으로 인식될 때까지 1-2초 기다리세요</li>
              <li>• 밝은 환경에서 사용하면 인식률이 높아집니다</li>
            </ul>
          </div>
        </div>

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
            <div className="h-20 bg-indigo-100 rounded p-4">
              <p className="text-indigo-800">테스트 블록 6</p>
            </div>
            <div className="h-20 bg-pink-100 rounded p-4">
              <p className="text-pink-800">테스트 블록 7</p>
            </div>
            <div className="h-20 bg-orange-100 rounded p-4">
              <p className="text-orange-800">테스트 블록 8</p>
            </div>
            <div className="h-20 bg-teal-100 rounded p-4">
              <p className="text-teal-800">테스트 블록 9</p>
            </div>
            <div className="h-20 bg-cyan-100 rounded p-4">
              <p className="text-cyan-800">테스트 블록 10</p>
            </div>
            <div className="h-20 bg-lime-100 rounded p-4">
              <p className="text-lime-800">테스트 블록 11</p>
            </div>
            <div className="h-20 bg-emerald-100 rounded p-4">
              <p className="text-emerald-800">테스트 블록 12</p>
            </div>
            <div className="h-20 bg-amber-100 rounded p-4">
              <p className="text-amber-800">테스트 블록 13</p>
            </div>
            <div className="h-20 bg-rose-100 rounded p-4">
              <p className="text-rose-800">테스트 블록 14</p>
            </div>
            <div className="h-20 bg-slate-100 rounded p-4">
              <p className="text-slate-800">테스트 블록 15</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 고정된 카메라 창 - 오른쪽 상단 */}
      <div className={`fixed top-4 right-4 bg-black rounded-lg shadow-lg z-50 overflow-hidden transition-all duration-300 ${
        isCameraActive ? (isCameraFloating ? 'w-64 h-48' : 'w-80 h-60') : 'w-64 h-32'
      }`}>
        <div className="relative w-full h-full">
          {/* 카메라 활성화되지 않은 상태 */}
          {!isCameraActive && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <div className="text-lg mb-2">📹</div>
                <div className="text-sm mb-3">카메라 비활성화됨</div>
                <button
                  onClick={handleToggle}
                  className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                >
                  활성화
                </button>
              </div>
            </div>
          )}
          
          {/* 카메라 활성화된 상태 */}
          {isCameraActive && (
            <>
              {/* 비디오 요소 */}
              <video
                ref={floatingVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
                style={{
                  transform: 'scaleX(-1)' // 좌우 반전으로 미러링 효과
                }}
              />
              
              {/* 손 인식 오버레이 캔버스 - 메인 캔버스를 복사 */}
              <canvas
                ref={floatingCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  transform: 'scaleX(-1)' // 비디오와 같은 방향으로 미러링
                }}
              />
              
              {/* 시스템 상태 표시 */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                <div>카메라: ✅</div>
                <div>손: {handDetected ? '✅ 감지됨' : '⏳ 감지 중...'}</div>
                <div>MediaPipe: {mediaPipeLoaded ? '✅ 로드됨' : '⏳ 로딩 중'}</div>
                <div>상태: {handGesture !== 'none' ? handGesture : '대기 중'}</div>
                <div>안정성: {gestureCount}/2</div>
              </div>
              
              {/* 제스처 상태 표시 */}
              <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs text-right">
                <div>
                  {handGesture === 'up' ? '⬆️ 위로 (손 접힘)' : 
                   handGesture === 'down' ? '⬇️ 아래로 (손 펴짐)' : 
                   handGesture === 'center' ? '➡️ 정면 (손 펴짐)' : 
                   handGesture === 'two_finger_touch' ? '✌️ 두손가락 터치' :
                   handGesture === 'index_fast_down' ? '👆 검지-빠른 아래' :
                   handGesture === 'middle_up' ? '👆 중지-위로' :
                   handGesture === 'ring_down' ? '👆 약지-아래로' :
                   handGesture === 'pinky_fast_up' ? '👆 새끼-빠른 위' :
                   handGesture === 'thumb_top' ? '👆 엄지-탑으로' :
                   handGesture === 'peace_fast_down' ? '✌️ 평화-빠른 아래' :
                   handGesture === 'index_ring_fast_up' ? '🤟 검지+약지-빠른 위' :
                   handGesture === 'rock_fast_up' ? '🤘 락-빠른 위' :
                   handGesture === 'middle_ring_up' ? '✌️ 중지+약지-위' :
                   handGesture === 'middle_pinky_down' ? '✌️ 중지+새끼-아래' :
                   handGesture === 'ring_pinky_very_fast_down' ? '✌️ 약지+새끼-매우 빠른 아래' :
                   handGesture === 'three_very_fast_up' ? '🤘 검지+중지+약지-매우 빠른 위' :
                   handGesture === 'four_bottom' ? '✋ 검지+중지+약지+새끼-끝으로' :
                   '⏸️ 없음'}
                </div>
                <div>{isScrolling ? '스크롤 중' : '대기 중'}</div>
              </div>
              
              {/* 스크롤 방향 표시 */}
              {scrollDirection !== 'none' && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                  {scrollDirection === 'down' && '⬇️ 아래로 스크롤 (300px)'}
                  {scrollDirection === 'up' && '⬆️ 위로 스크롤 (500px)'}
                  {scrollDirection === 'two_finger_touch' && '✌️ 두손가락 터치-아래로 (400px)'}
                  {scrollDirection === 'index_fast_down' && '👆 검지-빠른 아래 (600px)'}
                  {scrollDirection === 'middle_up' && '👆 중지-위로 (400px)'}
                  {scrollDirection === 'ring_down' && '👆 약지-아래로 (500px)'}
                  {scrollDirection === 'pinky_fast_up' && '👆 새끼-빠른 위 (800px)'}
                  {scrollDirection === 'thumb_top' && '👆 엄지-탑으로 이동'}
                  {scrollDirection === 'peace_fast_down' && '✌️ 평화-빠른 아래 (800px)'}
                  {scrollDirection === 'index_ring_fast_up' && '🤟 검지+약지-빠른 위 (900px)'}
                  {scrollDirection === 'rock_fast_up' && '🤘 락-빠른 위 (1000px)'}
                  {scrollDirection === 'middle_ring_up' && '✌️ 중지+약지-위 (600px)'}
                  {scrollDirection === 'middle_pinky_down' && '✌️ 중지+새끼-아래 (700px)'}
                  {scrollDirection === 'ring_pinky_very_fast_down' && '✌️ 약지+새끼-매우 빠른 아래 (1200px)'}
                  {scrollDirection === 'three_very_fast_up' && '🤘 검지+중지+약지-매우 빠른 위 (1500px)'}
                  {scrollDirection === 'four_bottom' && '✋ 검지+중지+약지+새끼-끝으로 이동'}
                  {scrollDirection === 'center' && '➡️ 대기 중'}
                </div>
              )}
              
              {/* 제어 버튼들 */}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button
                  onClick={handleToggle}
                  className="bg-red-500 text-white w-6 h-6 rounded-full text-xs hover:bg-red-600 transition-colors"
                  title="비활성화"
                >
                  ×
                </button>
                <button
                  onClick={() => setIsCameraFloating(!isCameraFloating)}
                  className="bg-blue-500 text-white w-6 h-6 rounded-full text-xs hover:bg-blue-600 transition-colors"
                  title={isCameraFloating ? '크게' : '작게'}
                >
                  {isCameraFloating ? '□' : '_'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
