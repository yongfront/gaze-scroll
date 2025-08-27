import React, { useRef, useEffect, useState } from 'react';
import { Camera, Eye, EyeOff, AlertCircle } from 'lucide-react';

const GazeTracker = ({ isActive, isPaused, settings }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gazeDirection, setGazeDirection] = useState('center');
  const [gazeAngle, setGazeAngle] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [error, setError] = useState(null);

  // MediaPipe 초기화
  useEffect(() => {
    if (!isActive) return;

    const initializeMediaPipe = async () => {
      try {
        // MediaPipe 스크립트 동적 로드
        if (!window.FaceMesh) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
          script.onload = () => initializeFaceMesh();
          document.head.appendChild(script);
        } else {
          initializeFaceMesh();
        }
      } catch (err) {
        setError('MediaPipe 초기화 실패: ' + err.message);
      }
    };

    initializeMediaPipe();
  }, [isActive]);

  const initializeFaceMesh = async () => {
    try {
      // 카메라 스트림 시작
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setIsInitialized(true);
        setError(null);
      }
    } catch (err) {
      setError('카메라 접근 실패: ' + err.message);
    }
  };

  // 시선 추적 및 스크롤 제어
  useEffect(() => {
    if (!isActive || isPaused || !isInitialized) {
      setIsScrolling(false);
      return;
    }

    let scrollInterval;
    let lastGazeTime = 0;

    const processGaze = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // 비디오 프레임을 캔버스에 그리기
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // 간단한 시선 방향 추정 (실제로는 MediaPipe 결과를 사용해야 함)
      // 여기서는 데모용으로 랜덤한 시선 방향을 시뮬레이션
      const now = Date.now();
      if (now - lastGazeTime > 1000) { // 1초마다 업데이트
        const randomAngle = Math.random() * 60 - 30; // -30도 ~ +30도
        setGazeAngle(randomAngle);
        
        if (randomAngle < -settings.sensitivity) {
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
        } else if (randomAngle > settings.sensitivity) {
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
  }, [isActive, isPaused, isInitialized, settings.sensitivity, settings.scrollSpeed]);

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
        <h3 className="text-lg font-semibold text-gray-800 mb-2">시선 추적</h3>
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            isCameraActive ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-sm text-gray-600">
            {isCameraActive ? '카메라 활성' : '카메라 연결 중...'}
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
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />
        
        {/* 시선 방향 표시 */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {gazeDirection === 'down' && '⬇️ 아래'}
          {gazeDirection === 'up' && '⬆️ 위'}
          {gazeDirection === 'center' && '➡️ 정면'}
        </div>
      </div>

      {/* 시선 각도 표시 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">시선 각도</span>
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
        </div>
      </div>
    </div>
  );
};

export default GazeTracker;
