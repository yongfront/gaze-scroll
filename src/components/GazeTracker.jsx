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
          height: 480,
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

        // 손가락 5개 펴기 감지
        const isHandOpen = detectOpenHand(landmarks);

        if (isHandOpen) {
          setHandDetected(true);
          setShowGuide(false);

          // 손 위치에 따른 제스처 감지
          const handPosition = getHandPosition(
            landmarks,
            canvas.width,
            canvas.height
          );
          const gesture = detectGesture(handPosition, canvas.height);

          setHandGesture(gesture);
          setScrollDirection(gesture);

          // 제스처에 따른 스크롤 제어
          handleScroll(gesture);

          // 손 랜드마크 그리기
          drawHandLandmarks(ctx, landmarks, canvas.width, canvas.height);
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

  // 손가락 5개 펴기 감지
  const detectOpenHand = (landmarks) => {
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerPips = [3, 6, 10, 14, 18];

    let openFingers = 0;

    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPips[i]];

      if (i === 0) {
        if (tip.x < pip.x) openFingers++;
      } else {
        if (tip.y < pip.y) openFingers++;
      }
    }

    return openFingers >= 4;
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
    const threshold = 80;

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
      window.scrollBy({
        top: settings.scrollSpeed,
        behavior: "smooth",
      });
    } else if (gesture === "up") {
      setIsScrolling(false);
      window.scrollBy({
        top: -settings.scrollSpeed * 2,
        behavior: "smooth",
      });
    } else {
      setIsScrolling(false);
    }
  };

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
    <div className="space-y-4">
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
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-48 object-cover"
        />

        {/* 손 인식 오버레이 캔버스 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* 손 인식 가이드 */}
        {showGuide && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-blue-500 bg-opacity-20 border-2 border-blue-400 border-dashed rounded-lg p-4 text-center">
              <Move className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-100 text-sm font-medium mb-1">
                손가락 5개를 펴주세요
              </p>
              <p className="text-blue-200 text-xs">
                이 영역에 손을 보여주세요
              </p>
            </div>
          </div>
        )}

        {/* 제스처 방향 표시 */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {scrollDirection === "down" && "⬇️ 아래로 스크롤"}
          {scrollDirection === "up" && "⬆️ 위로 스크롤"}
          {scrollDirection === "center" && "➡️ 대기 중"}
        </div>

        {/* 손 감지 정보 */}
        {handDetected && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            <div>손가락 5개 펴기 ✅</div>
            <div>제스처: {handGesture}</div>
          </div>
        )}
      </div>

      {/* 손 제스처 상태 */}
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-medium text-green-800 mb-2">손 제스처 상태</h4>
        <div className="space-y-2 text-sm">
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
            <span className="text-green-700">현재 제스처:</span>
            <span className="text-green-800 font-medium">
              {handGesture === "up" && "⬆️ 위로"}
              {handGesture === "down" && "⬇️ 아래로"}
              {handGesture === "center" && "➡️ 정면"}
              {handGesture === "none" && "⏸️ 없음"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">스크롤 방향:</span>
            <span className="text-green-800 font-medium">
              {scrollDirection === "up" && "⬆️ 위로"}
              {scrollDirection === "down" && "⬇️ 아래로"}
              {scrollDirection === "center" && "⏸️ 정지"}
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
              {settings.sensitivity}°
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">스크롤 속도:</span>
            <span className="text-blue-800 font-medium">
              {settings.scrollSpeed}px
            </span>
          </div>
        </div>
      </div>

      {/* 사용법 안내 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">🎯 사용법</h4>
        <div className="text-sm text-yellow-700 space-y-1">
          <div>
            • <strong>손가락 5개를 펴세요</strong> → 손 인식 활성화
          </div>
          <div>
            • <strong>손을 위로</strong> → 페이지 위로 스크롤
          </div>
          <div>
            • <strong>손을 아래로</strong> → 페이지 아래로 스크롤
          </div>
          <div>
            • <strong>손을 중앙에</strong> → 스크롤 정지
          </div>
        </div>
      </div>
    </div>
  );
};

export default GazeTracker;
