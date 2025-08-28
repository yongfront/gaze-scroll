// 설정 관리 시스템
// 모든 설정을 중앙에서 관리하고 쉽게 변경할 수 있도록 설계됨

class SettingsManager {
  constructor() {
    this.settings = new Map();
    this.defaultSettings = {
      // 제스처 인식 설정
      gesture: {
        sensitivity: {
          finger_distance_threshold: 0.08,
          detection_confidence: 0.6,
          tracking_confidence: 0.6,
          gesture_cooldown: 800
        },
        stabilization: {
          history_size: 5,
          stability_threshold: 3
        }
      },

      // 스크롤 설정
      scroll: {
        speeds: {
          slow: 200,
          normal: 300,
          fast: 500,
          instant: 1000
        },
        smooth_scrolling: true,
        scroll_behavior: 'smooth'
      },

      // 시각적 피드백 설정
      feedback: {
        enabled: true,
        duration: 1500,
        position: 'center',
        style: 'modern'
      },

      // 카메라 설정
      camera: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'user'
      },

      // 플러그인 설정
      plugins: {
        enabled: true,
        auto_load: true
      },

      // 디버그 설정
      debug: {
        enabled: false,
        log_level: 'info',
        show_landmarks: false
      }
    };

    this.initializeSettings();
    this.loadSettings();
  }

  // 기본 설정 초기화
  initializeSettings() {
    Object.entries(this.defaultSettings).forEach(([category, settings]) => {
      this.settings.set(category, { ...settings });
    });
  }

  // 설정 가져오기
  getSetting(path, defaultValue = null) {
    const keys = path.split('.');
    let current = Object.fromEntries(this.settings);

    for (const key of keys) {
      if (current[key] === undefined) {
        return defaultValue;
      }
      current = current[key];
    }

    return current;
  }

  // 설정 변경하기
  setSetting(path, value) {
    const keys = path.split('.');
    const category = keys[0];

    if (!this.settings.has(category)) {
      console.warn(`알 수 없는 설정 카테고리: ${category}`);
      return false;
    }

    let current = this.settings.get(category);
    let parent = null;
    let lastKey = null;

    for (let i = 1; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      parent = current;
      lastKey = key;
      current = current[key];
    }

    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;

    this.saveSettings();
    console.log(`설정 변경됨: ${path} = ${value}`);
    return true;
  }

  // 카테고리별 설정 가져오기
  getCategorySettings(category) {
    return this.settings.get(category) || {};
  }

  // 카테고리별 설정 변경하기
  setCategorySettings(category, settings) {
    this.settings.set(category, { ...settings });
    this.saveSettings();
    console.log(`카테고리 설정 변경됨: ${category}`);
  }

  // 모든 설정 가져오기
  getAllSettings() {
    return Object.fromEntries(this.settings);
  }

  // 설정 내보내기
  exportSettings() {
    const exportData = {
      settings: Object.fromEntries(this.settings),
      exported: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 설정 가져오기
  importSettings(jsonData) {
    try {
      const importData = JSON.parse(jsonData);

      if (importData.settings) {
        Object.entries(importData.settings).forEach(([category, settings]) => {
          this.settings.set(category, { ...settings });
        });
        this.saveSettings();
        console.log('설정 가져오기 완료');
        return true;
      }
      return false;
    } catch (error) {
      console.error('설정 가져오기 실패:', error);
      return false;
    }
  }

  // 설정 초기화
  resetSettings() {
    this.settings.clear();
    this.initializeSettings();
    this.saveSettings();
    console.log('설정이 초기화되었습니다');
  }

  // 설정 저장
  saveSettings() {
    try {
      const settingsToSave = Object.fromEntries(this.settings);
      localStorage.setItem('gesture_scroll_settings', JSON.stringify(settingsToSave));
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  }

  // 설정 불러오기
  loadSettings() {
    try {
      const saved = localStorage.getItem('gesture_scroll_settings');
      if (saved) {
        const loadedSettings = JSON.parse(saved);
        Object.entries(loadedSettings).forEach(([category, settings]) => {
          const currentSettings = this.settings.get(category);
          if (currentSettings) {
            this.settings.set(category, { ...currentSettings, ...settings });
          } else {
            this.settings.set(category, settings);
          }
        });
        console.log('설정이 로드되었습니다');
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    }
  }

  // 설정 변경 리스너 등록 (옵저버 패턴)
  addChangeListener(callback) {
    if (!this.changeListeners) {
      this.changeListeners = new Set();
    }
    this.changeListeners.add(callback);
  }

  // 설정 변경 리스너 제거
  removeChangeListener(callback) {
    if (this.changeListeners) {
      this.changeListeners.delete(callback);
    }
  }

  // 설정 변경 알림
  notifyChangeListeners(path, oldValue, newValue) {
    if (this.changeListeners) {
      this.changeListeners.forEach(callback => {
        try {
          callback(path, oldValue, newValue);
        } catch (error) {
          console.error('설정 변경 리스너 오류:', error);
        }
      });
    }
  }

  // 유틸리티 메소드들
  getSensitivity() {
    return this.getSetting('gesture.sensitivity');
  }

  setSensitivity(sensitivity) {
    return this.setCategorySettings('gesture', { ...this.getCategorySettings('gesture'), sensitivity });
  }

  getScrollSpeeds() {
    return this.getSetting('scroll.speeds');
  }

  isDebugEnabled() {
    return this.getSetting('debug.enabled', false);
  }

  enableDebug(enabled = true) {
    return this.setSetting('debug.enabled', enabled);
  }

  // 설정 검증
  validateSettings() {
    const errors = [];

    // 민감도 검증
    const sensitivity = this.getSetting('gesture.sensitivity.finger_distance_threshold');
    if (sensitivity < 0 || sensitivity > 1) {
      errors.push('finger_distance_threshold는 0~1 사이여야 합니다');
    }

    // 쿨다운 검증
    const cooldown = this.getSetting('gesture.sensitivity.gesture_cooldown');
    if (cooldown < 100 || cooldown > 5000) {
      errors.push('gesture_cooldown는 100~5000ms 사이여야 합니다');
    }

    return errors;
  }

  // 설정 설명 가져오기
  getSettingDescription(path) {
    const descriptions = {
      'gesture.sensitivity.finger_distance_threshold': '손가락 펴짐 감지 임계값 (0.01~0.2)',
      'gesture.sensitivity.detection_confidence': '손 인식 정확도 (0.1~0.9)',
      'gesture.sensitivity.tracking_confidence': '손 추적 정확도 (0.1~0.9)',
      'gesture.sensitivity.gesture_cooldown': '제스처 인식 쿨다운 시간 (ms)',
      'scroll.speeds.slow': '느린 스크롤 속도',
      'scroll.speeds.normal': '보통 스크롤 속도',
      'scroll.speeds.fast': '빠른 스크롤 속도',
      'scroll.smooth_scrolling': '부드러운 스크롤 사용 여부',
      'feedback.enabled': '시각적 피드백 표시 여부',
      'feedback.duration': '피드백 표시 시간 (ms)',
      'debug.enabled': '디버그 모드 활성화'
    };

    return descriptions[path] || '설명 없음';
  }
}

// 전역 인스턴스 생성
const settingsManager = new SettingsManager();
