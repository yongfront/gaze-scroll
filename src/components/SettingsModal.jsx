import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings({
      sensitivity: 20,
      scrollSpeed: 50,
      showCameraView: true,
      autoScroll: true
    });
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">설정</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 설정 내용 */}
        <div className="p-6 space-y-6">
          {/* 민감도 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              민감도: {localSettings.sensitivity}°
            </label>
            <input
              type="range"
              min="5"
              max="45"
              step="5"
              value={localSettings.sensitivity}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                sensitivity: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5°</span>
              <span>25°</span>
              <span>45°</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              낮을수록 민감하게 반응합니다
            </p>
          </div>

          {/* 스크롤 속도 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              스크롤 속도: {localSettings.scrollSpeed}px
            </label>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={localSettings.scrollSpeed}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                scrollSpeed: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>20px</span>
              <span>60px</span>
              <span>100px</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              높을수록 빠르게 스크롤됩니다
            </p>
          </div>

          {/* 카메라 뷰 설정 */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={localSettings.showCameraView}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  showCameraView: e.target.checked
                })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-700">카메라 뷰 표시</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              시선 추적 화면을 표시합니다
            </p>
          </div>

          {/* 자동 스크롤 설정 */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={localSettings.autoScroll}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  autoScroll: e.target.checked
                })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-700">자동 스크롤</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              시선 방향에 따라 자동으로 스크롤합니다
            </p>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>초기화</span>
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
