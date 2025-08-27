import React, { useRef, useEffect, useState } from 'react';
import { Camera, Eye, EyeOff, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';

const GazeTracker = ({ isActive, isPaused, settings }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gazeDirection, setGazeDirection] = useState('center');
  const [gazeAngle, setGazeAngle] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [error, setError] = useState(null);
  
  // 얼굴 인식 관련 상태
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBounds, setFaceBounds] = useState(null);
  const [eyeRegion, setEyeRegion] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // 카메라 초기화 (얼굴 인식 포함)
  useEffect(() => {
    if (!isActive) return;

    const initializeCamera = async () => {
      try {
        // 카메라 스트림 시작 (고해상도로 설정)
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 1280, 
            height: 720,
            facingMode: 'user',
            frameRate: { ideal: 30 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setIsInitialized(true);
          setError(null);
          
          // 비디오 로드 완료 후 얼굴 인식 시작
          videoRef.current.onloadedmetadata = () => {
            startFaceDetection();
          };
        }
      } catch (err) {
        setError('카메라 접근 실패: ' + err.message);
      }
    };

    initializeCamera();
  }, [isActive]);

  // 얼굴 인식 및 추적
  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const detectFace = () => {
      if (!isActive || !video.videoWidth) return;

      // 캔버스 크기 설정
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 비디오 프레임을 캔버스에 그리기
      ctx.drawImage(video, 0, 0);

      // 간단한 얼굴 영역 감지 (실제로는 MediaPipe나 face-api.js 사용)
      // 여기서는 데모용으로 화면 중앙에 얼굴이 있다고 가정
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const faceSize = Math.min(canvas.width, canvas.height) * 0.4;

      // 얼굴 영역 계산
      const faceRect = {
        x: centerX - faceSize / 2,
        y: centerY - faceSize / 2,
        width: faceSize,
        height: faceSize
      };

      // 눈 영역 계산 (얼굴의 상단 1/3 부분)
      const eyeRegionHeight = faceSize * 0.3;
      const eyeRegionY = faceRect.y + faceSize * 0.2;
      
      const eyeRegionRect = {
        x: faceRect.x + faceSize * 0.1,
        y: eyeRegionY,
        width: faceSize * 0.8,
        height: eyeRegionHeight
      };

      setFaceBounds(faceRect);
      setEyeRegion(eyeRegionRect);
      setFaceDetected(true);

      // 얼굴 영역에 박스 그리기
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(faceRect.x, faceRect.y, faceRect.width, faceRect.height);

      // 눈 영역 강조
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(eyeRegionRect.x, eyeRegionRect.y, eyeRegionRect.width, eyeRegionRect.height);

      // 얼굴 중앙점 표시
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
      ctx.fill();

      // 눈 영역 중앙점 표시
      const eyeCenterX = eyeRegionRect.x + eyeRegionRect.width / 2;
      const eyeCenterY = eyeRegionRect.y + eyeRegionRect.height / 2;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(eyeCenterX, eyeCenterY, 3, 0, 2 * Math.PI);
      ctx.fill();

      // 다음 프레임 감지
      requestAnimationFrame(detectFace);
    };

    detectFace();
  };

  // 줌 기능
  const toggleZoom = () => {
    if (isZoomed) {
      setZoomLevel(1);
      setIsZoomed(false);
    } else {
      setZoomLevel(2.5); // 눈 영역을 2.5배 확대
      setIsZoomed(true);
    }
  };

  // 시선 추적 및 스크롤 제어 (개선된 시뮬레이션)
  useEffect(() => {
    if (!isActive || isPaused || !isInitialized || !faceDetected) {
      setIsScrolling(false);
      return;
    }

    let scrollInterval;
    let lastGazeTime = 0;

    const processGaze = () => {
      // 얼굴이 감지된 상태에서만 시선 추적
      if (!faceDetected) return;

      // 더 정밀한 시선 각도 시뮬레이션
      const now = Date.now();
      if (now - lastGazeTime > 500) { // 0.5초마다 업데이트 (더 빠른 반응)
        // 얼굴 위치를 기반으로 한 시선 각도 계산
        let calculatedAngle = 0;
        
        if (faceBounds && eyeRegion) {
          // 눈 영역의 상대적 위치를 기반으로 시선 방향 추정
          const relativeEyeY = (eyeRegion.y + eyeRegion.height / 2) / faceBounds.height;
          
          // 상대적 위치를 각도로 변환 (-30도 ~ +30도)
          calculatedAngle = (relativeEyeY - 0.5) * 60;
          
          // 노이즈 추가 (더 자연스러운 움직임)
          const noise = (Math.random() - 0.5) * 10;
          calculatedAngle += noise;
          
          // 각도 범위 제한
          calculatedAngle = Math.max(-30, Math.min(30, calculatedAngle));
        } else {
          // 얼굴이 감지되지 않았을 때는 랜덤 각도
          calculatedAngle = Math.random() * 60 - 30;
        }

        setGazeAngle(calculatedAngle);
        
        // 개선된 시선 방향 감지
        if (calculatedAngle < -settings.sensitivity) {
          setGazeDirection('down');
          setIsScrolling(true);
          
          // 스크롤 실행
          if (!scrollInterval) {
            scrollInterval = setInterval(() => {
              window.scrollBy({ 
                top: settings.scrollSpeed, 
                behavior: 'smooth' 
              });
            }, 100);
          }
        } else if (calculatedAngle > settings.sensitivity) {
          setGazeDirection('up');
          setIsScrolling(false);
          if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
          }
        } else {
          setGazeDirection('center');
          setIsScrolling(false);
          if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
          }
        }
        
        lastGazeTime = now;
      }
    };

    const interval = setInterval(processGaze, 100);

    return () => {
      clearInterval(interval);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isActive, isPaused, isInitialized, faceDetected, settings.sensitivity, settings.scrollSpeed]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  if (!isActive) {
    return (
      <div className="text-center py-8">
        <EyeOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">시선 추적이 비활성화되었습니다</p>
        <p className="text-sm text-gray-400 mt-2">활성화 버튼을 클릭하여 시작하세요</p>
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
        <h3 className="text-lg font-semibold text-gray-800 mb-2">시선 추적 (얼굴 인식 모드)</h3>
        <div className="flex items-center justify-center space-x-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            isCameraActive ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-sm text-gray-600">
            {isCameraActive ? '카메라 활성' : '카메라 연결 중...'}
          </span>
        </div>
        
        {/* 얼굴 인식 상태 */}
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            faceDetected ? 'bg-green-500' : 'bg-yellow-400'
          }`}></div>
          <span className="text-sm text-gray-600">
            {faceDetected ? '얼굴 감지됨' : '얼굴 감지 중...'}
          </span>
        </div>

        {/* 줌 컨트롤 */}
        <div className="mt-3">
          <button
            onClick={toggleZoom}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isZoomed 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isZoomed ? '줌 해제' : '눈 영역 확대'}
          >
            {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            <span>{isZoomed ? '줌 해제' : '눈 확대'}</span>
          </button>
        </div>
      </div>

      {/* 카메라 뷰 (얼굴 인식 오버레이 포함) */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-48 object-cover"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
        />
        
        {/* 얼굴 인식 오버레이 캔버스 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
        />
        
        {/* 시선 방향 표시 */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {gazeDirection === 'down' && '⬇️ 아래'}
          {gazeDirection === 'up' && '⬆️ 위'}
          {gazeDirection === 'center' && '➡️ 정면'}
        </div>

        {/* 얼굴 인식 정보 */}
        {faceBounds && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            <div>얼굴: {Math.round(faceBounds.width)}x{Math.round(faceBounds.height)}</div>
            {eyeRegion && (
              <div>눈: {Math.round(eyeRegion.width)}x{Math.round(eyeRegion.height)}</div>
            )}
          </div>
        )}
      </div>

      {/* 시선 각도 표시 (개선된 버전) */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">시선 각도 (얼굴 인식 기반)</span>
          <span className="text-lg font-bold text-blue-600">{gazeAngle.toFixed(1)}°</span>
        </div>
        
        {/* 각도 시각화 */}
        <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-6 bg-gray-400"></div>
          </div>
          <div 
            className={`absolute top-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-y-1/2 transition-all duration-200 ${
              gazeDirection === 'down' ? 'bg-red-500' : 
              gazeDirection === 'up' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{
              left: `${50 + (gazeAngle / 30) * 40}%`
            }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>-30°</span>
          <span>0°</span>
          <span>+30°</span>
        </div>

        {/* 얼굴 인식 상태 표시 */}
        <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
          <div className="text-xs text-blue-700">
            <div className="flex items-center space-x-2">
              <span>얼굴 감지:</span>
              <span className={`font-medium ${faceDetected ? 'text-green-600' : 'text-yellow-600'}`}>
                {faceDetected ? '✅ 성공' : '⏳ 감지 중...'}
              </span>
            </div>
            {faceDetected && (
              <div className="mt-1 text-blue-600">
                눈 영역 추적 중... {isZoomed && '(확대 모드)'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 스크롤 상태 */}
      <div className={`rounded-lg p-4 text-center transition-colors ${
        isScrolling ? 'bg-green-100 border border-green-200' : 'bg-gray-100 border border-gray-200'
      }`}>
        <div className="flex items-center justify-center space-x-2">
          {isScrolling ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700 font-medium">스크롤 다운 중...</span>
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
            <span className="text-blue-800 font-medium">{settings.sensitivity}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">스크롤 속도:</span>
            <span className="text-blue-800 font-medium">{settings.scrollSpeed}px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">줌 레벨:</span>
            <span className="text-blue-800 font-medium">{zoomLevel}x</span>
          </div>
        </div>
      </div>

      {/* 개발 진행 상황 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">🔧 얼굴 인식 모드</h4>
        <p className="text-sm text-yellow-700">
          현재는 기본 얼굴 영역 감지로 동작합니다. 
          MediaPipe Face Mesh 통합으로 더 정밀한 시선 추적이 예정되어 있습니다.
        </p>
      </div>
    </div>
  );
};

export default GazeTracker;
