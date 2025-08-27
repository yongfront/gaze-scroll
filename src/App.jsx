import React, { useState, useRef, useEffect } from 'react';
import { Camera, Settings, Pause, Play, Eye, EyeOff } from 'lucide-react';
import GazeTracker from './components/GazeTracker';
import SettingsModal from './components/SettingsModal';
import './App.css';

function App() {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [settings, setSettings] = useState({
    sensitivity: 20,
    scrollSpeed: 50,
    showCameraView: true,
    autoScroll: true
  });

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    setShowCamera(newSettings.showCameraView);
  };

  const toggleActive = () => {
    setIsActive(!isActive);
    if (isActive) {
      setIsPaused(false);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 상태 바 */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
              {isActive ? '시선 스크롤 활성화' : '시선 스크롤 비활성화'}
            </div>
            
            {isActive && (
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                isPaused ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
              }`}>
                {isPaused ? (
                  <>
                    <Pause className="w-4 h-4" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    스크롤 중
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCamera(!showCamera)}
              className={`p-2 rounded-lg transition-colors ${
                showCamera ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}
              title={showCamera ? '카메라 뷰 숨기기' : '카메라 뷰 보이기'}
            >
              {showCamera ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="설정"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {isActive && (
              <button
                onClick={togglePause}
                className={`p-2 rounded-lg transition-colors ${
                  isPaused ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                }`}
                title={isPaused ? '스크롤 재개' : '스크롤 일시정지'}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
            )}
            
            <button
              onClick={toggleActive}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            >
              {isActive ? '비활성화' : '활성화'}
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex">
        {/* 왼쪽: 웹페이지 컨텐츠 시뮬레이션 */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">GazeScroll 데모 페이지</h1>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">시선으로 스크롤하기</h2>
              <p className="text-gray-600 mb-4">
                이 페이지는 시선 추적을 통한 자동 스크롤 기능을 테스트하기 위한 데모 페이지입니다.
                상단의 "활성화" 버튼을 클릭하고, 카메라 앞에서 아래쪽을 바라보면 자동으로 스크롤됩니다.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">사용법:</h3>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                  <li>상단의 "활성화" 버튼을 클릭합니다</li>
                  <li>카메라 권한을 허용합니다</li>
                  <li>화면 아래쪽을 바라보면 자동으로 스크롤됩니다</li>
                  <li>정면을 바라보면 스크롤이 멈춥니다</li>
                </ol>
              </div>
            </div>

            {/* 긴 컨텐츠로 스크롤 테스트 */}
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">섹션 {i + 1}</h3>
                <p className="text-gray-600">
                  이것은 스크롤 테스트를 위한 더미 컨텐츠입니다. 시선 추적 기능이 제대로 작동하는지 확인하기 위해 
                  충분한 길이의 컨텐츠를 제공합니다. 아래쪽을 바라보면 자동으로 스크롤되어 이 섹션들을 볼 수 있습니다.
                </p>
                <div className="mt-4 p-3 bg-gray-50 rounded border">
                  <p className="text-sm text-gray-500">
                    📍 현재 위치: {i + 1}번째 섹션 | 
                    시선 각도: {isActive ? '감지 중...' : '비활성화'} | 
                    스크롤 상태: {isActive ? (isPaused ? '일시정지' : '활성') : '비활성'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 카메라 뷰 및 시선 추적 */}
        {showCamera && (
          <div className="w-80 bg-white border-l border-gray-200 p-4">
            <GazeTracker 
              isActive={isActive}
              isPaused={isPaused}
              settings={settings}
            />
          </div>
        )}
      </div>

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default App;
