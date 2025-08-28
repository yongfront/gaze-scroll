// 플러그인 관리 시스템
// 새로운 기능을 쉽게 추가하고 관리할 수 있도록 설계됨

class PluginManager {
  constructor() {
    this.plugins = new Map(); // 플러그인 저장소
    this.activePlugins = new Set(); // 활성화된 플러그인
    this.pluginConfigs = new Map(); // 플러그인 설정

    this.initializeDefaultPlugins();
    this.loadPluginConfigs();
  }

  // 기본 플러그인들 초기화
  initializeDefaultPlugins() {
    // 스크롤 플러그인
    this.registerPlugin('scroll', {
      name: '스크롤 제어',
      version: '1.0.0',
      description: '기본적인 스크롤 제어 기능',
      author: 'System',
      enabled: true,
      actions: {
        scrollUp: (speed = 300) => ({ action: 'SCROLL_UP', speed }),
        scrollDown: (speed = 300) => ({ action: 'SCROLL_DOWN', speed }),
        scrollTop: () => ({ action: 'SCROLL_TOP' }),
        scrollBottom: () => ({ action: 'SCROLL_BOTTOM' })
      }
    });

    // 시각적 피드백 플러그인
    this.registerPlugin('visual-feedback', {
      name: '시각적 피드백',
      version: '1.0.0',
      description: '제스처 인식 시 시각적 피드백 표시',
      author: 'System',
      enabled: true,
      actions: {
        showGestureFeedback: (gestureType) => {
          const gestureNames = {
            'fist': '✊ 주먹',
            'one_finger': '☝️ 한 손가락',
            'peace': '✌️ 평화',
            'two_fingers': '✌️ 두 손가락',
            'three_fingers': '🤟 세 손가락',
            'open_hand': '🖐️ 손바닥'
          };

          this.showFeedback(gestureNames[gestureType] || gestureType);
        }
      }
    });

    // 기본 플러그인들을 활성화
    this.enablePlugin('scroll');
    this.enablePlugin('visual-feedback');
  }

  // 플러그인 등록
  registerPlugin(key, pluginDefinition) {
    const plugin = {
      ...pluginDefinition,
      key: key,
      enabled: false,
      loaded: false,
      created: Date.now(),
      initialize: pluginDefinition.initialize || (() => {}),
      destroy: pluginDefinition.destroy || (() => {})
    };

    this.plugins.set(key, plugin);
    console.log(`플러그인 등록됨: ${key} - ${pluginDefinition.name}`);
  }

  // 플러그인 활성화
  enablePlugin(key) {
    const plugin = this.plugins.get(key);
    if (!plugin) {
      console.error(`플러그인을 찾을 수 없음: ${key}`);
      return false;
    }

    if (!plugin.loaded) {
      try {
        plugin.initialize();
        plugin.loaded = true;
      } catch (error) {
        console.error(`플러그인 초기화 실패: ${key}`, error);
        return false;
      }
    }

    plugin.enabled = true;
    this.activePlugins.add(key);
    console.log(`플러그인 활성화됨: ${key}`);
    return true;
  }

  // 플러그인 비활성화
  disablePlugin(key) {
    const plugin = this.plugins.get(key);
    if (!plugin) {
      return false;
    }

    plugin.enabled = false;
    this.activePlugins.delete(key);

    if (plugin.loaded) {
      try {
        plugin.destroy();
      } catch (error) {
        console.warn(`플러그인 정리 실패: ${key}`, error);
      }
    }

    console.log(`플러그인 비활성화됨: ${key}`);
    return true;
  }

  // 플러그인 실행
  executePluginAction(pluginKey, actionName, ...args) {
    const plugin = this.plugins.get(pluginKey);
    if (!plugin || !plugin.enabled) {
      console.warn(`플러그인이 활성화되지 않음: ${pluginKey}`);
      return null;
    }

    const action = plugin.actions[actionName];
    if (!action) {
      console.warn(`플러그인 액션을 찾을 수 없음: ${pluginKey}.${actionName}`);
      return null;
    }

    try {
      return action(...args);
    } catch (error) {
      console.error(`플러그인 액션 실행 실패: ${pluginKey}.${actionName}`, error);
      return null;
    }
  }

  // 모든 플러그인 가져오기
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  // 활성화된 플러그인만 가져오기
  getActivePlugins() {
    return Array.from(this.activePlugins).map(key => this.plugins.get(key));
  }

  // 플러그인 설정 관리
  setPluginConfig(pluginKey, config) {
    this.pluginConfigs.set(pluginKey, config);
    this.savePluginConfigs();
  }

  getPluginConfig(pluginKey) {
    return this.pluginConfigs.get(pluginKey) || {};
  }

  // 외부 플러그인 로드 (URL에서)
  async loadExternalPlugin(url, key) {
    try {
      const response = await fetch(url);
      const pluginCode = await response.text();

      // 안전하게 플러그인 실행
      const pluginFunction = new Function('pluginManager', 'gestureManager', pluginCode);
      const pluginDefinition = pluginFunction(this, gestureManager);

      this.registerPlugin(key, pluginDefinition);
      console.log(`외부 플러그인 로드됨: ${key}`);
      return true;
    } catch (error) {
      console.error(`외부 플러그인 로드 실패: ${key}`, error);
      return false;
    }
  }

  // 플러그인 내보내기
  exportPlugins() {
    const exportData = {
      plugins: Object.fromEntries(this.plugins),
      configs: Object.fromEntries(this.pluginConfigs),
      activePlugins: Array.from(this.activePlugins),
      exported: new Date().toISOString()
    };
    return JSON.stringify(exportData, null, 2);
  }

  // 플러그인 가져오기
  importPlugins(jsonData) {
    try {
      const importData = JSON.parse(jsonData);

      if (importData.plugins) {
        Object.entries(importData.plugins).forEach(([key, plugin]) => {
          this.registerPlugin(key, plugin);
        });
      }

      if (importData.configs) {
        Object.entries(importData.configs).forEach(([key, config]) => {
          this.setPluginConfig(key, config);
        });
      }

      if (importData.activePlugins) {
        importData.activePlugins.forEach(key => {
          this.enablePlugin(key);
        });
      }

      console.log('플러그인 가져오기 완료');
      return true;
    } catch (error) {
      console.error('플러그인 가져오기 실패:', error);
      return false;
    }
  }

  // 설정 저장/불러오기
  savePluginConfigs() {
    try {
      const configs = Object.fromEntries(this.pluginConfigs);
      localStorage.setItem('gesture_scroll_plugin_configs', JSON.stringify(configs));
    } catch (error) {
      console.error('플러그인 설정 저장 실패:', error);
    }
  }

  loadPluginConfigs() {
    try {
      const saved = localStorage.getItem('gesture_scroll_plugin_configs');
      if (saved) {
        const configs = JSON.parse(saved);
        Object.entries(configs).forEach(([key, config]) => {
          this.pluginConfigs.set(key, config);
        });
        console.log('플러그인 설정 로드됨');
      }
    } catch (error) {
      console.error('플러그인 설정 로드 실패:', error);
    }
  }

  // 시각적 피드백 표시 헬퍼 메소드
  showFeedback(message) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 15px;
      font-size: 24px;
      font-weight: bold;
      z-index: 99999;
      animation: gestureFade 1.5s forwards;
      border: 3px solid #4CAF50;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes gestureFade {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;

    feedback.textContent = message;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) feedback.remove();
      if (style.parentNode) style.remove();
    }, 1500);
  }
}

// 전역 인스턴스 생성
const pluginManager = new PluginManager();
