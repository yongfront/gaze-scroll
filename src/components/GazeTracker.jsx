import React, { useRef, useEffect, useState } from "react";
import { Hand, HandOff, AlertCircle, CheckCircle, XCircle, Move } from "lucide-react";

const GazeTracker = ({ isActive, settings }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [handGesture, setHandGesture] = useState("none");
  const [scrollDirection, setScrollDirection] = useState("none");
  const [isScrolling, setIsScrolling] = useState(false);
  const [error, setError] = useState(null);
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [fingerCount, setFingerCount] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [fingerStates, setFingerStates] = useState({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false
  });
  const [isFloatingMode, setIsFloatingMode] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [scrollIndicator, setScrollIndicator] = useState(null);
  const [currentAdvancedGesture, setCurrentAdvancedGesture] = useState(null);

  // MediaPipe Hands 초기화
  useEffect(() => {
    if (!isActive) return;

    const loadMediaPipe = async () => {
      try {
        // MediaPipe Hands 스크립트 동적 로드
        if (!window.Hands) {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js";
          script.onload = () => {
            setMediaPipeLoaded(true);
            initializeCamera();
          };
          script.onerror = () => {
            setError("MediaPipe Hands 로드 실패");
          };
          document.head.appendChild(script);
        } else {
          setMediaPipeLoaded(true);
          initializeCamera();
        }
      } catch (err) {
        setError("MediaPipe 초기화 실패: " + err.message);
      }
    };

    loadMediaPipe();
  }, [isActive]);

  // 카메라 초기화
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 360,
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);

        // 비디오 로드 완료 후 손 인식 시작
        videoRef.current.onloadedmetadata = () => {
          if (mediaPipeLoaded) {
            startHandDetection();
          }
        };
      }
    } catch (err) {
      setError("카메라 접근 실패: " + err.message);
    }
  };

  // 손 인식 및 제스처 감지
  const startHandDetection = () => {
    if (!videoRef.current || !canvasRef.current || !window.Hands) return;

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
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // 손가락 개수 및 펴기 감지 + 고급 제스처
        const { isOpen, count, states, advancedGesture } = detectOpenHandWithCount(landmarks);
        const avgConfidence = results.multiHandedness ?
          results.multiHandedness[0].score : 0;

        setFingerCount(count);
        setConfidence(avgConfidence);
        setFingerStates(states);
        setCurrentAdvancedGesture(advancedGesture);

        if (isOpen || advancedGesture.type !== 'unknown') {
          setHandDetected(true);
          setShowGuide(false);

          let finalGesture = null;
          let scrollDirection = null;

          // 고급 제스처 우선 처리
          if (advancedGesture.type !== 'unknown' && advancedGesture.type !== 'open_hand') {
            finalGesture = advancedGesture.type;
            scrollDirection = advancedGesture.scroll;
            console.log("고급 제스처 감지:", advancedGesture);

            // 고급 제스처에 따른 스크롤 실행
            handleAdvancedScroll(advancedGesture);
          } else {
            // 기존 위치 기반 제스처 (손바닥 펴기)
            const handPosition = getHandPosition(
              landmarks,
              canvas.width,
              canvas.height
            );
            const positionGesture = detectGesture(handPosition, canvas.height);

            finalGesture = positionGesture;
            scrollDirection = positionGesture;

            // 디버깅 로그 추가
            console.log("위치 기반 제스처 감지:", {
              handPosition: handPosition,
              canvasHeight: canvas.height,
              centerY: canvas.height / 2,
              threshold: 25,
              gesture: positionGesture,
              fingerCount: count
            });

            // 위치 기반 스크롤 제어
            if (count >= 3) {
              handleScroll(positionGesture);
            } else {
              console.log("손가락이 충분히 펴지지 않음:", count);
            }
          }

          setHandGesture(finalGesture);
          setScrollDirection(scrollDirection);

          // 손 랜드마크 그리기
          drawHandLandmarks(ctx, landmarks, canvas.width, canvas.height);

          // 제스처 인식 영역 표시
          drawGestureZones(ctx, canvas.width, canvas.height);

          // 현재 손 위치 표시
          drawHandPosition(ctx, handPosition, canvas.width, canvas.height);
        } else {
          setHandDetected(false);
          setHandGesture("none");
          setScrollDirection("none");
          setIsScrolling(false);
          setShowGuide(true);
        }
      } else {
        setHandDetected(false);
        setHandGesture("none");
        setScrollDirection("none");
        setIsScrolling(false);
        setShowGuide(true);
        setFingerCount(0);
        setConfidence(0);
        setFingerStates({
          thumb: false,
          index: false,
          middle: false,
          ring: false,
          pinky: false
        });
        setCurrentAdvancedGesture(null);
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

  // 제스처 인식 영역 표시
  const drawGestureZones = (ctx, canvasWidth, canvasHeight) => {
    const centerY = canvasHeight / 2;
    const threshold = 25;

    // 위쪽 영역 (파란색)
    ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
    ctx.fillRect(0, 0, canvasWidth, centerY - threshold);

    // 중앙 영역 (회색)
    ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
    ctx.fillRect(0, centerY - threshold, canvasWidth, threshold * 2);

    // 아래쪽 영역 (초록색)
    ctx.fillStyle = 'rgba(0, 255, 100, 0.2)';
    ctx.fillRect(0, centerY + threshold, canvasWidth, canvasHeight - (centerY + threshold));

    // 구분선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // 위쪽 구분선
    ctx.beginPath();
    ctx.moveTo(0, centerY - threshold);
    ctx.lineTo(canvasWidth, centerY - threshold);
    ctx.stroke();

    // 아래쪽 구분선
    ctx.beginPath();
    ctx.moveTo(0, centerY + threshold);
    ctx.lineTo(canvasWidth, centerY + threshold);
    ctx.stroke();

    ctx.setLineDash([]); // 점선 초기화

    // 영역 라벨
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // 위쪽 라벨
    ctx.fillText('⬆️ 위로 스크롤', canvasWidth / 2, (centerY - threshold) / 2);

    // 중앙 라벨
    ctx.fillText('⏸️ 정지', canvasWidth / 2, centerY);

    // 아래쪽 라벨
    ctx.fillText('⬇️ 아래로 스크롤', canvasWidth / 2, centerY + threshold + (canvasHeight - centerY - threshold) / 2);
  };

  // 현재 손 위치 표시
  const drawHandPosition = (ctx, handPosition, canvasWidth, canvasHeight) => {
    const centerY = canvasHeight / 2;
    const threshold = 25;

    // 손 위치에 큰 점 표시
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(handPosition.x, handPosition.y, 12, 0, 2 * Math.PI);
    ctx.fill();

    // 점 테두리
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 현재 영역 표시
    let currentZone = "중앙";
    let zoneColor = 'rgba(128, 128, 128, 0.3)';

    if (handPosition.y < centerY - threshold) {
      currentZone = "위쪽";
      zoneColor = 'rgba(0, 100, 255, 0.4)';
    } else if (handPosition.y > centerY + threshold) {
      currentZone = "아래쪽";
      zoneColor = 'rgba(0, 255, 100, 0.4)';
    }

    // 현재 영역 하이라이트
    ctx.fillStyle = zoneColor;
    if (currentZone === "위쪽") {
      ctx.fillRect(0, 0, canvasWidth, centerY - threshold);
    } else if (currentZone === "아래쪽") {
      ctx.fillRect(0, centerY + threshold, canvasWidth, canvasHeight - (centerY + threshold));
    } else {
      ctx.fillRect(0, centerY - threshold, canvasWidth, threshold * 2);
    }

    // 현재 영역 텍스트
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`현재: ${currentZone} 영역`, canvasWidth / 2, handPosition.y - 25);
  };

  // 손가락 개수 및 펴기 감지 + 고급 제스처 감지
  const detectOpenHandWithCount = (landmarks) => {
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerPips = [3, 6, 10, 14, 18];
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    let openFingers = 0;
    const states = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false
    };

    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPips[i]];
      const fingerName = fingerNames[i];
      let isOpen = false;

      if (i === 0) {
        // 엄지손가락 (좌우 방향)
        isOpen = tip.x < pip.x;
      } else {
        // 다른 손가락들 (상하 방향)
        isOpen = tip.y < pip.y;
      }

      states[fingerName] = isOpen;
      if (isOpen) openFingers++;
    }

    // 고급 제스처 감지
    const advancedGesture = detectAdvancedGesture(states, landmarks);

    return {
      isOpen: openFingers >= 3, // 3개로 완화
      count: openFingers,
      states: states,
      advancedGesture: advancedGesture
    };
  };

  // 고급 제스처 감지
  const detectAdvancedGesture = (fingerStates, landmarks) => {
    const { thumb, index, middle, ring, pinky } = fingerStates;
    const openCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;

    // 한 손가락 제스처들
    if (openCount === 1) {
      if (thumb) return { type: 'thumb_only', scroll: 'top', speed: 0 }; // 맨 위로
      if (index) return { type: 'index_only', scroll: 'down', speed: 600 }; // 빠른 아래
      if (middle) return { type: 'middle_only', scroll: 'up', speed: 400 }; // 위로
      if (ring) return { type: 'ring_only', scroll: 'down', speed: 500 }; // 아래로
      if (pinky) return { type: 'pinky_only', scroll: 'up', speed: 800 }; // 빠른 위
    }

    // 두 손가락 제스처들
    if (openCount === 2) {
      if (index && middle) {
        // 검지+중지 거리 계산 (평화 vs 터치 구분)
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const distance = Math.sqrt(
          Math.pow(indexTip.x - middleTip.x, 2) +
          Math.pow(indexTip.y - middleTip.y, 2)
        );

        if (distance < 0.1) { // 가까우면 터치
          return { type: 'peace_touch', scroll: 'down', speed: 400 };
        } else { // 멀면 평화
          return { type: 'peace', scroll: 'down', speed: 800 };
        }
      }
      if (index && ring) return { type: 'index_ring', scroll: 'up', speed: 900 };
      if (index && pinky) return { type: 'rock', scroll: 'up', speed: 1000 }; // 락
      if (middle && ring) return { type: 'middle_ring', scroll: 'up', speed: 600 };
      if (middle && pinky) return { type: 'middle_pinky', scroll: 'down', speed: 700 };
      if (ring && pinky) return { type: 'ring_pinky', scroll: 'down', speed: 1200 };
    }

    // 세 손가락 이상 제스처들
    if (openCount === 3) {
      if (index && middle && ring) return { type: 'three_up', scroll: 'up', speed: 1500 };
    }

    if (openCount === 4) {
      if (index && middle && ring && pinky) return { type: 'four_down', scroll: 'bottom', speed: 0 };
    }

    // 손바닥 펴기 (기존 로직)
    if (openCount >= 3) {
      return { type: 'open_hand', scroll: null, speed: null }; // 위치에 따라 결정
    }

    // 손 접기
    if (openCount === 0) {
      return { type: 'closed_hand', scroll: 'up', speed: 500 };
    }

    return { type: 'unknown', scroll: null, speed: null };
  };

  // 제스처 이름 변환 함수
  const getGestureDisplayName = (gestureType) => {
    const gestureNames = {
      'thumb_only': '엄지만 ✊',
      'index_only': '검지만 👆',
      'middle_only': '중지만 🖕',
      'ring_only': '약지만 🤞',
      'pinky_only': '새끼만 👌',
      'peace': '평화 ✌️',
      'peace_touch': '평화 터치 🤏',
      'index_ring': '검지+약지 🤞',
      'rock': '락 🤘',
      'middle_ring': '중지+약지 🤞',
      'middle_pinky': '중지+새끼 👌',
      'ring_pinky': '약지+새끼 🤞',
      'three_up': '세 손가락 🤟',
      'four_down': '네 손가락 🤟',
      'closed_hand': '주먹 ✊',
      'open_hand': '손바닥 🖐️'
    };
    return gestureNames[gestureType] || gestureType;
  };

  // 손 위치 계산
  const getHandPosition = (landmarks, canvasWidth, canvasHeight) => {
    const palmCenter = landmarks[0];
    return {
      x: palmCenter.x * canvasWidth,
      y: palmCenter.y * canvasHeight,
    };
  };

  // 제스처 감지
  const detectGesture = (handPosition, canvasHeight) => {
    const centerY = canvasHeight / 2;
    const threshold = 25; // threshold를 25로 낮춤 (더 민감하게)

    if (handPosition.y < centerY - threshold) {
      return "up";
    } else if (handPosition.y > centerY + threshold) {
      return "down";
    } else {
      return "center";
    }
  };

  // 고급 제스처용 스크롤 제어
  const handleAdvancedScroll = (advancedGesture) => {
    const currentScrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    console.log("고급 제스처 스크롤 호출:", advancedGesture);

    // 시각적 인디케이터 표시
    setScrollIndicator({
      direction: advancedGesture.scroll === 'up' ? 'up' :
                 advancedGesture.scroll === 'down' ? 'down' :
                 advancedGesture.scroll === 'top' ? 'top' :
                 advancedGesture.scroll === 'bottom' ? 'bottom' : 'special',
      timestamp: Date.now()
    });

    requestAnimationFrame(() => {
      try {
        let targetScrollY = currentScrollY;

        switch (advancedGesture.scroll) {
          case 'up':
            targetScrollY = Math.max(currentScrollY - advancedGesture.speed, 0);
            break;
          case 'down':
            targetScrollY = Math.min(currentScrollY + advancedGesture.speed, documentHeight - windowHeight);
            break;
          case 'top':
            targetScrollY = 0;
            break;
          case 'bottom':
            targetScrollY = documentHeight - windowHeight;
            break;
        }

        window.scrollTo({
          top: targetScrollY,
          behavior: "smooth"
        });

        console.log("고급 제스처 스크롤 완료:", {
          type: advancedGesture.type,
          direction: advancedGesture.scroll,
          speed: advancedGesture.speed,
          from: currentScrollY,
          to: targetScrollY
        });
      } catch (error) {
        console.error("고급 제스처 스크롤 실행 오류:", error);
        // 폴백
        let targetScrollY = currentScrollY;
        switch (advancedGesture.scroll) {
          case 'up':
            targetScrollY = Math.max(currentScrollY - advancedGesture.speed, 0);
            break;
          case 'down':
            targetScrollY = Math.min(currentScrollY + advancedGesture.speed, documentHeight - windowHeight);
            break;
          case 'top':
            targetScrollY = 0;
            break;
          case 'bottom':
            targetScrollY = documentHeight - windowHeight;
            break;
        }
        window.scrollTo(0, targetScrollY);
      }
    });

    // 인디케이터 제거
    setTimeout(() => setScrollIndicator(null), 1000);
  };

  // 기존 위치 기반 스크롤 제어
  const handleScroll = (gesture) => {
    const scrollSpeed = settings?.scrollSpeed || 150;
    const currentScrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    console.log("스크롤 제어 호출:", {
      gesture,
      scrollSpeed,
      currentScrollY,
      windowHeight,
      documentHeight,
      settings
    });

    if (gesture === "down") {
      setIsScrolling(true);
      console.log("아래로 스크롤 실행");

      // 시각적 인디케이터 표시
      setScrollIndicator({ direction: "down", timestamp: Date.now() });

      // requestAnimationFrame을 사용한 부드러운 스크롤
      requestAnimationFrame(() => {
        try {
          // 기본 스크롤 방법
          const newScrollY = Math.min(currentScrollY + scrollSpeed, documentHeight - windowHeight);
          window.scrollTo({
            top: newScrollY,
            behavior: "smooth"
          });
          console.log("스크롤 완료 - 현재 위치:", window.scrollY);
        } catch (error) {
          console.error("스크롤 실행 오류:", error);
          // 폴백: 직접 스크롤
          const newScrollY = Math.min(currentScrollY + scrollSpeed, documentHeight - windowHeight);
          window.scrollTo(0, newScrollY);
        }
      });

      // 인디케이터 제거
      setTimeout(() => setScrollIndicator(null), 1000);

    } else if (gesture === "up") {
      setIsScrolling(false);
      console.log("위로 스크롤 실행");

      // 시각적 인디케이터 표시
      setScrollIndicator({ direction: "up", timestamp: Date.now() });

      // requestAnimationFrame을 사용한 부드러운 스크롤
      requestAnimationFrame(() => {
        try {
          const newScrollY = Math.max(currentScrollY - scrollSpeed, 0);
          window.scrollTo({
            top: newScrollY,
            behavior: "smooth"
          });
          console.log("스크롤 완료 - 현재 위치:", window.scrollY);
        } catch (error) {
          console.error("스크롤 실행 오류:", error);
          // 폴백: 직접 스크롤
          const newScrollY = Math.max(currentScrollY - scrollSpeed, 0);
          window.scrollTo(0, newScrollY);
        }
      });

      // 인디케이터 제거
      setTimeout(() => setScrollIndicator(null), 1000);

    } else {
      setIsScrolling(false);
      console.log("스크롤 정지");
      setScrollIndicator(null);
    }
  };

  // 스크롤 감지 및 모드 전환
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      // 스크롤이 일정량 이상 되면 플로팅 모드 활성화
      if (scrollY > 100) {
        setIsFloatingMode(true);
        // 더 많이 스크롤하면 미니 모드로 전환
        if (scrollY > windowHeight * 0.5) {
          setIsMiniMode(true);
        } else {
          setIsMiniMode(false);
        }
      } else {
        setIsFloatingMode(false);
        setIsMiniMode(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  if (!isActive) {
    return (
      <div className="text-center py-8">
        <HandOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">손 제스처 인식이 비활성화되었습니다</p>
        <p className="text-sm text-gray-400 mt-2">
          활성화 버튼을 클릭하여 시작하세요
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 font-medium mb-2">오류 발생</p>
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 transition-all duration-300 ${
      isFloatingMode ? 'pr-72' : ''
    }`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          손 제스처 인식 (MediaPipe)
        </h3>

        {/* 카메라 상태 */}
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isCameraActive ? "bg-green-500" : "bg-gray-400"
            }`}
          ></div>
          <span className="text-sm text-gray-600">
            {isCameraActive ? "카메라 활성" : "카메라 연결 중..."}
          </span>
        </div>

        {/* MediaPipe 상태 */}
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div
            className={`w-3 h-3 rounded-full ${
              mediaPipeLoaded ? "bg-green-500" : "bg-yellow-400"
            }`}
          ></div>
          <span className="text-sm text-gray-600">
            {mediaPipeLoaded ? "MediaPipe 로드됨" : "MediaPipe 로딩 중..."}
          </span>
        </div>

        {/* 플로팅 모드 토글 버튼 */}
        <div className="flex justify-center space-x-2 mb-4">
          <button
            onClick={() => {
              setIsFloatingMode(!isFloatingMode);
              if (!isFloatingMode) {
                setIsMiniMode(false);
              }
            }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isFloatingMode
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📱 플로팅 모드 {isFloatingMode ? 'ON' : 'OFF'}
          </button>
          {isFloatingMode && (
            <button
              onClick={() => setIsMiniMode(!isMiniMode)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isMiniMode
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🔍 미니 모드 {isMiniMode ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {/* 손 감지 상태 */}
        <div className="flex items-center justify-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              handDetected ? "bg-green-500" : "bg-yellow-400"
            }`}
          ></div>
          <span className="text-sm text-gray-600">
            {handDetected ? "손 감지됨" : "손 감지 중..."}
          </span>
        </div>
      </div>

      {/* 카메라 뷰 */}
      <div
        className={`relative bg-black rounded-lg overflow-hidden transition-all duration-300 ${
          isFloatingMode
            ? 'fixed top-4 right-4 z-50 shadow-2xl'
            : ''
        } ${
          isMiniMode
            ? 'w-64 h-36'
            : 'w-full'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`${
            isMiniMode
              ? 'w-full h-full object-cover'
              : 'w-full h-48 object-contain bg-black'
          }`}
          style={{ aspectRatio: isMiniMode ? '16/9' : '16/9' }}
        />

        {/* 손 인식 오버레이 캔버스 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* 스크롤 인디케이터 */}
      {scrollIndicator && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className={`bg-black bg-opacity-80 text-white px-8 py-4 rounded-full text-2xl font-bold flex items-center space-x-3 animate-bounce ${
            scrollIndicator.direction === "down" ? "bg-green-600" :
            scrollIndicator.direction === "up" ? "bg-blue-600" :
            scrollIndicator.direction === "top" ? "bg-purple-600" :
            scrollIndicator.direction === "bottom" ? "bg-red-600" :
            "bg-yellow-600"
          }`}>
            {scrollIndicator.direction === "down" && (
              <>
                <span>⬇️</span>
                <span>스크롤 다운!</span>
                <span>⬇️</span>
              </>
            )}
            {scrollIndicator.direction === "up" && (
              <>
                <span>⬆️</span>
                <span>스크롤 업!</span>
                <span>⬆️</span>
              </>
            )}
            {scrollIndicator.direction === "top" && (
              <>
                <span>🔝</span>
                <span>맨 위로!</span>
                <span>🔝</span>
              </>
            )}
            {scrollIndicator.direction === "bottom" && (
              <>
                <span>🔻</span>
                <span>맨 아래로!</span>
                <span>🔻</span>
              </>
            )}
            {scrollIndicator.direction === "special" && (
              <>
                <span>✨</span>
                <span>특수 제스처!</span>
                <span>✨</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 손 인식 가이드 */}
        {showGuide && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-blue-500 bg-opacity-20 border-2 border-blue-400 border-dashed rounded-lg p-6 text-center max-w-sm">
              <Move className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-blue-100 text-base font-medium mb-2">
                손가락 5개를 펴주세요
              </p>
              <p className="text-blue-200 text-sm mb-3">
                이 영역에 손을 보여주세요
              </p>
              <div className="bg-blue-600 bg-opacity-30 rounded p-3 text-xs text-blue-100">
                <p className="font-medium mb-1">📋 제스처 사용법:</p>
                <p>1. 손가락 5개를 모두 펴세요</p>
                <p>2. 손을 위로 올리면 ↑ 위로 스크롤</p>
                <p>3. 손을 아래로 내리면 ↓ 아래로 스크롤</p>
                <p>4. 손을 가운데로 하면 ⏸️ 정지</p>
              </div>
            </div>
          </div>
        )}

        {/* 제스처 방향 표시 */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm">
          <div className="font-medium mb-2">🎯 제스처 상태</div>
          <div className="space-y-2">
            <div className={`text-center py-2 px-3 rounded font-medium ${
              scrollDirection === "up" ? "bg-blue-500" :
              scrollDirection === "down" ? "bg-green-500" :
              "bg-gray-500"
            }`}>
              {scrollDirection === "down" && "⬇️ 아래로 스크롤"}
              {scrollDirection === "up" && "⬆️ 위로 스크롤"}
              {scrollDirection === "center" && "⏸️ 대기 중"}
            </div>

            {/* 제스처 조건 상태 */}
            <div className="text-xs space-y-1">
              <div className={`flex items-center space-x-1 ${
                fingerCount >= 3 ? "text-green-300" : "text-red-300"
              }`}>
                <span>{fingerCount >= 3 ? "✅" : "❌"}</span>
                <span>손가락 3개 이상 펴기</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                handDetected ? "text-green-300" : "text-red-300"
              }`}>
                <span>{handDetected ? "✅" : "❌"}</span>
                <span>손 감지됨</span>
              </div>
              {/* 고급 제스처 표시 */}
              {currentAdvancedGesture && currentAdvancedGesture.type !== 'unknown' && (
                <div className="text-yellow-300 bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                  🎯 {getGestureDisplayName(currentAdvancedGesture.type)}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-300 text-center border-t border-gray-600 pt-1">
              💡 손을 위/아래로 움직여보세요
            </div>
          </div>
        </div>

        {/* 손 감지 정보 */}
        <div className={`absolute bg-black bg-opacity-80 text-white rounded-lg text-sm space-y-2 transition-all duration-300 ${
          isMiniMode
            ? 'top-1 right-1 px-2 py-1 text-xs'
            : 'top-2 right-2 px-3 py-3 min-w-[200px]'
        }`}>
          <div className={`font-bold text-yellow-300 text-center ${
            isMiniMode ? 'text-xs' : 'text-base'
          }`}>
            📊 실시간 정보
          </div>

          {/* 손가락 개수 - 크게 표시 */}
          <div className={`text-center rounded ${
            isMiniMode
              ? 'py-1 bg-blue-600 bg-opacity-30'
              : 'py-2 bg-blue-600 bg-opacity-30'
          }`}>
            <div className={`text-blue-200 mb-1 ${
              isMiniMode ? 'text-[10px]' : 'text-xs'
            }`}>
              손가락 개수
            </div>
            <div className={`font-bold ${
              isMiniMode
                ? 'text-xl'
                : fingerCount === 5 ? 'text-green-400' :
                  fingerCount >= 4 ? 'text-yellow-400' :
                  fingerCount >= 2 ? 'text-orange-400' :
                  'text-red-400'
            } ${
              isMiniMode
                ? 'text-green-400'
                : 'text-3xl'
            }`}>
              {fingerCount}개
            </div>
          </div>

          {/* 미니 모드가 아닐 때만 손가락 상태 표시 */}
          {!isMiniMode && (
            <>
              {/* 각 손가락 상태 */}
              <div className="space-y-1">
                <div className="text-xs text-gray-300 mb-1">손가락 상태:</div>
                <div className="grid grid-cols-5 gap-1 text-xs">
                  <div className="text-center">
                    <div className={`text-lg ${fingerStates.thumb ? 'text-green-400' : 'text-red-400'}`}>
                      {fingerStates.thumb ? '👍' : '👎'}
                    </div>
                    <div className="text-[10px] text-gray-400">엄지</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${fingerStates.index ? 'text-green-400' : 'text-red-400'}`}>
                      {fingerStates.index ? '☝️' : '👇'}
                    </div>
                    <div className="text-[10px] text-gray-400">검지</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${fingerStates.middle ? 'text-green-400' : 'text-red-400'}`}>
                      {fingerStates.middle ? '☝️' : '👇'}
                    </div>
                    <div className="text-[10px] text-gray-400">중지</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${fingerStates.ring ? 'text-green-400' : 'text-red-400'}`}>
                      {fingerStates.ring ? '☝️' : '👇'}
                    </div>
                    <div className="text-[10px] text-gray-400">약지</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg ${fingerStates.pinky ? 'text-green-400' : 'text-red-400'}`}>
                      {fingerStates.pinky ? '☝️' : '👇'}
                    </div>
                    <div className="text-[10px] text-gray-400">소지</div>
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-600">
                <div>손 감지: {handDetected ? "✅" : "❌"}</div>
                <div>정확도: {(confidence * 100).toFixed(1)}%</div>
                <div>제스처: {
                  handGesture === "up" ? "⬆️ 위로" :
                  handGesture === "down" ? "⬇️ 아래로" :
                  handGesture === "center" ? "⏸️ 정지" :
                  currentAdvancedGesture ? getGestureDisplayName(currentAdvancedGesture.type) :
                  "없음"
                }</div>
                <div>스크롤: {
                  scrollDirection === "up" ? "⬆️ 위로" :
                  scrollDirection === "down" ? "⬇️ 아래로" :
                  scrollDirection === "top" ? "⬆️ 맨 위로" :
                  scrollDirection === "bottom" ? "⬇️ 맨 아래로" :
                  "정지"
                }</div>
              </div>
            </>
          )}

          {/* 미니 모드에서는 간단한 정보만 표시 */}
          {isMiniMode && (
            <div className="space-y-1">
              <div>감지: {handDetected ? "✅" : "❌"}</div>
              <div>제스처: {
                handGesture === "up" ? "⬆️" :
                handGesture === "down" ? "⬇️" :
                handGesture === "center" ? "⏸️" :
                currentAdvancedGesture ? getGestureDisplayName(currentAdvancedGesture.type).slice(0, 3) :
                "❓"
              }</div>
            </div>
          )}
        </div>
      </div>

      {/* 손 제스처 상태 - 플로팅 모드가 아닐 때만 표시 */}
      {!isFloatingMode && (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">📊 상세 상태 정보</h4>

        {/* 손가락 개수 크게 표시 */}
        <div className="text-center mb-4 p-3 bg-white rounded-lg border-2 border-green-200">
          <div className="text-sm text-green-700 mb-1">현재 손가락 개수</div>
          <div className={`text-4xl font-bold ${
            fingerCount === 5 ? 'text-green-500' :
            fingerCount >= 4 ? 'text-blue-500' :
            fingerCount >= 2 ? 'text-yellow-500' :
            'text-red-500'
          }`}>
            {fingerCount}
            <span className="text-lg ml-1">개</span>
          </div>
        </div>

        {/* 각 손가락 상태 표시 */}
        <div className="mb-4">
          <h5 className="text-sm font-medium text-green-700 mb-2">손가락별 상태</h5>
          <div className="grid grid-cols-5 gap-2">
            <div className="text-center p-2 bg-white rounded border">
              <div className={`text-2xl mb-1 ${fingerStates.thumb ? 'text-green-500' : 'text-gray-400'}`}>
                {fingerStates.thumb ? '👍' : '👎'}
              </div>
              <div className="text-xs text-gray-600">엄지</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className={`text-2xl mb-1 ${fingerStates.index ? 'text-green-500' : 'text-gray-400'}`}>
                {fingerStates.index ? '☝️' : '👇'}
              </div>
              <div className="text-xs text-gray-600">검지</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className={`text-2xl mb-1 ${fingerStates.middle ? 'text-green-500' : 'text-gray-400'}`}>
                {fingerStates.middle ? '☝️' : '👇'}
              </div>
              <div className="text-xs text-gray-600">중지</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className={`text-2xl mb-1 ${fingerStates.ring ? 'text-green-500' : 'text-gray-400'}`}>
                {fingerStates.ring ? '☝️' : '👇'}
              </div>
              <div className="text-xs text-gray-600">약지</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className={`text-2xl mb-1 ${fingerStates.pinky ? 'text-green-500' : 'text-gray-400'}`}>
                {fingerStates.pinky ? '☝️' : '👇'}
              </div>
              <div className="text-xs text-gray-600">소지</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-700">손 감지:</span>
              <span
                className={`font-medium ${
                  handDetected ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {handDetected ? "✅ 성공" : "⏳ 감지 중..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">감지 정확도:</span>
              <span className="text-green-800 font-medium">
                {(confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-700">현재 제스처:</span>
              <span className="text-green-800 font-medium">
                {handGesture === "up" && "⬆️ 위로"}
                {handGesture === "down" && "⬇️ 아래로"}
                {handGesture === "center" && "➡️ 정면"}
                {currentAdvancedGesture && getGestureDisplayName(currentAdvancedGesture.type)}
                {handGesture === "none" && !currentAdvancedGesture && "⏸️ 없음"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">스크롤 상태:</span>
              <span className="text-green-800 font-medium">
                {isScrolling ? "🎯 활성" : "⏸️ 대기"}
              </span>
            </div>
          </div>
        </div>

        {/* 스크롤 상태 */}
        <div
          className={`rounded-lg p-4 text-center transition-colors ${
            isScrolling
              ? "bg-green-100 border border-green-200"
              : "bg-gray-100 border border-gray-200"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            {isScrolling ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">
                  스크롤 다운 중...
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600">대기 중</span>
              </>
            )}
          </div>
        </div>

        {/* 설정 정보 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">현재 설정</h4>
          <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
            <span className="text-blue-700">민감도:</span>
            <span className="text-blue-800 font-medium">
              {settings?.sensitivity || 20}°
            </span>
          </div>
                      <div className="flex justify-between">
            <span className="text-blue-700">스크롤 속도:</span>
            <span className="text-blue-800 font-medium">
              {settings?.scrollSpeed || 150}px
            </span>
          </div>
          </div>
        </div>

                {/* 사용법 안내 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">🎯 고급 제스처 사용법</h4>
          <div className="text-sm text-yellow-700 space-y-2">
            <div className="font-medium text-yellow-800">🖐️ 기본 제스처:</div>
            <div>• 손가락 3개 이상 펴고 위/아래로 움직이기</div>

            <div className="font-medium text-yellow-800">👆 한 손가락 제스처:</div>
            <div>• 엄지만 ✊ → 맨 위로 이동</div>
            <div>• 검지만 👆 → 빠른 아래 (600px)</div>
            <div>• 중지만 🖕 → 위로 (400px)</div>
            <div>• 약지만 🤞 → 아래로 (500px)</div>
            <div>• 새끼만 👌 → 빠른 위 (800px)</div>

            <div className="font-medium text-yellow-800">✌️ 두 손가락 제스처:</div>
            <div>• 평화 ✌️ → 빠른 아래 (800px)</div>
            <div>• 평화 터치 🤏 → 아래 (400px)</div>
            <div>• 락 🤘 → 빠른 위 (1000px)</div>

            <div className="font-medium text-yellow-800">✊ 손 접기:</div>
            <div>• 주먹 ✊ → 위로 스크롤 (500px)</div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default GazeTracker;
