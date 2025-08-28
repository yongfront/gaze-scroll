// 제스처 관리 시스템
// 새로운 제스처를 쉽게 추가하고 관리할 수 있도록 설계됨

class GestureManager {
  constructor() {
    this.gestures = new Map(); // 제스처 저장소
    this.profiles = new Map(); // 제스처 프로필 저장소
    this.activeProfile = 'default';
    this.customGestures = new Map(); // 사용자가 추가한 커스텀 제스처

    this.initializeDefaultGestures();
    this.loadCustomGestures();
  }

  // 기본 제스처들 초기화
  initializeDefaultGestures() {
    const defaultGestures = {
      'fist': {
        name: '주먹',
        icon: '✊',
        action: { type: 'scroll', direction: 'up', speed: 300 },
        description: '위로 스크롤'
      },
      'peace': {
        name: '평화',
        icon: '✌️',
        action: { type: 'scroll', direction: 'down', speed: 300 },
        description: '아래로 스크롤'
      },
      'one_finger': {
        name: '한 손가락',
        icon: '☝️',
        action: { type: 'scroll', direction: 'top' },
        description: '맨 위로 이동'
      },
      'two_fingers': {
        name: '두 손가락',
        icon: '✌️',
        action: { type: 'scroll', direction: 'bottom' },
        description: '맨 아래로 이동'
      },
      'three_fingers': {
        name: '세 손가락',
        icon: '🤟',
        action: { type: 'scroll', direction: 'down', speed: 500 },
        description: '빠르게 아래로'
      },
      'open_hand': {
        name: '손바닥 펼침',
        icon: '🖐️',
        action: { type: 'scroll', direction: 'down', speed: 200 },
        description: '천천히 아래로'
      },
      'thumb_only': {
        name: '엄지',
        icon: '👍',
        action: { type: 'scroll', direction: 'top' },
        description: '맨 위로 이동'
      },
      'thumb_index': {
        name: '엄지+검지',
        icon: '🤏',
        action: { type: 'scroll', direction: 'up', speed: 200 },
        description: '천천히 위로'
      }
    };

    // 기본 제스처들을 등록
    Object.entries(defaultGestures).forEach(([key, gesture]) => {
      this.registerGesture(key, gesture);
    });
  }

  // 제스처 등록
  registerGesture(key, gestureDefinition) {
    this.gestures.set(key, {
      ...gestureDefinition,
      key: key,
      enabled: true,
      created: Date.now()
    });
    console.log(`제스처 등록됨: ${key} - ${gestureDefinition.name}`);
  }

  // 커스텀 제스처 등록
  registerCustomGesture(key, gestureDefinition) {
    this.registerGesture(key, gestureDefinition);
    this.customGestures.set(key, gestureDefinition);

    // 로컬 스토리지에 저장
    this.saveCustomGestures();
  }

  // 제스처 제거
  unregisterGesture(key) {
    if (this.gestures.has(key)) {
      this.gestures.delete(key);
      this.customGestures.delete(key);
      this.saveCustomGestures();
      console.log(`제스처 제거됨: ${key}`);
      return true;
    }
    return false;
  }

  // 제스처 실행
  executeGesture(gestureKey, context = {}) {
    const gesture = this.gestures.get(gestureKey);
    if (!gesture || !gesture.enabled) {
      return null;
    }

    console.log(`제스처 실행: ${gesture.name} (${gestureKey})`);

    // 제스처 액션 실행
    return this.executeAction(gesture.action, context);
  }

  // 액션 실행
  executeAction(action, context = {}) {
    switch (action.type) {
      case 'scroll':
        return this.executeScrollAction(action, context);
      case 'custom':
        return this.executeCustomAction(action, context);
      default:
        console.warn(`알 수 없는 액션 타입: ${action.type}`);
        return null;
    }
  }

  // 스크롤 액션 실행
  executeScrollAction(action, context) {
    const scrollAction = {
      action: `SCROLL_${action.direction.toUpperCase()}`,
      speed: action.speed || 300
    };

    // 실제 스크롤 실행 (context에 scrollHandler가 있다고 가정)
    if (context.scrollHandler) {
      context.scrollHandler.handleScroll({
        direction: action.direction,
        speed: action.speed
      });
    }

    return scrollAction;
  }

  // 커스텀 액션 실행
  executeCustomAction(action, context) {
    if (typeof action.function === 'function') {
      return action.function(context);
    }
    return null;
  }

  // 모든 제스처 가져오기
  getAllGestures() {
    return Array.from(this.gestures.values());
  }

  // 활성화된 제스처만 가져오기
  getActiveGestures() {
    return Array.from(this.gestures.values()).filter(gesture => gesture.enabled);
  }

  // 제스처 검색
  findGesture(predicate) {
    for (const [key, gesture] of this.gestures) {
      if (predicate(gesture, key)) {
        return { key, gesture };
      }
    }
    return null;
  }

  // 제스처 활성화/비활성화
  setGestureEnabled(key, enabled) {
    const gesture = this.gestures.get(key);
    if (gesture) {
      gesture.enabled = enabled;
      console.log(`제스처 ${enabled ? '활성화' : '비활성화'}: ${key}`);
      return true;
    }
    return false;
  }

  // 프로필 관리
  createProfile(name, gestureKeys) {
    const profile = {
      name: name,
      gestures: gestureKeys,
      created: Date.now()
    };
    this.profiles.set(name, profile);
    this.saveProfiles();
    console.log(`프로필 생성됨: ${name}`);
  }

  setActiveProfile(profileName) {
    if (this.profiles.has(profileName)) {
      this.activeProfile = profileName;
      console.log(`활성 프로필 변경: ${profileName}`);
      return true;
    }
    return false;
  }

  getActiveProfile() {
    return this.profiles.get(this.activeProfile);
  }

  // 커스텀 제스처 저장/불러오기
  saveCustomGestures() {
    try {
      const customGestures = Object.fromEntries(this.customGestures);
      localStorage.setItem('gesture_scroll_custom_gestures', JSON.stringify(customGestures));
    } catch (error) {
      console.error('커스텀 제스처 저장 실패:', error);
    }
  }

  loadCustomGestures() {
    try {
      const saved = localStorage.getItem('gesture_scroll_custom_gestures');
      if (saved) {
        const customGestures = JSON.parse(saved);
        Object.entries(customGestures).forEach(([key, gesture]) => {
          this.registerCustomGesture(key, gesture);
        });
        console.log('커스텀 제스처 로드됨:', Object.keys(customGestures).length, '개');
      }
    } catch (error) {
      console.error('커스텀 제스처 로드 실패:', error);
    }
  }

  // 프로필 저장/불러오기
  saveProfiles() {
    try {
      const profiles = Object.fromEntries(this.profiles);
      localStorage.setItem('gesture_scroll_profiles', JSON.stringify(profiles));
    } catch (error) {
      console.error('프로필 저장 실패:', error);
    }
  }

  // 제스처 내보내기 (JSON)
  exportGestures() {
    const exportData = {
      gestures: Object.fromEntries(this.gestures),
      customGestures: Object.fromEntries(this.customGestures),
      profiles: Object.fromEntries(this.profiles),
      exported: new Date().toISOString()
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 제스처 가져오기 (JSON)
  importGestures(jsonData) {
    try {
      const importData = JSON.parse(jsonData);

      if (importData.gestures) {
        Object.entries(importData.gestures).forEach(([key, gesture]) => {
          this.registerGesture(key, gesture);
        });
      }

      if (importData.customGestures) {
        Object.entries(importData.customGestures).forEach(([key, gesture]) => {
          this.registerCustomGesture(key, gesture);
        });
      }

      console.log('제스처 가져오기 완료');
      return true;
    } catch (error) {
      console.error('제스처 가져오기 실패:', error);
      return false;
    }
  }
}

// 전역 인스턴스 생성
const gestureManager = new GestureManager();
