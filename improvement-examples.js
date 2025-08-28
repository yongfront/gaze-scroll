// 손 제스처 스크롤 개선 예제들
// 이 파일은 참고용입니다. content.js에 적용해서 테스트해보세요.

/*
1. 민감도 설정 추가하기
content.js에 다음 코드를 추가하면 민감도를 조정할 수 있습니다:
*/

// 민감도 설정 (0.0 ~ 1.0)
const GESTURE_SENSITIVITY = {
  finger_distance_threshold: 0.08,  // 손가락 펴짐 감지 임계값
  gesture_cooldown: 800,            // 제스처 쿨다운 시간 (ms)
  detection_confidence: 0.6         // MediaPipe 감지 정확도
};

// countExtendedFingers 메소드에서 사용
isExtended = pipToTipDistance > GESTURE_SENSITIVITY.finger_distance_threshold;

/*
2. 새로운 제스처 추가하기
content.js의 classifyGesture 메소드에 다음을 추가:
*/

case 5:
  // 손가락 모두 펴진 상태에서 추가 로직
  if (this.isHandOpenWide(landmarks)) {
    return 'super_open_hand';  // 아주 크게 펼친 손
  }
  return 'open_hand';

/*
3. 속도 프로필 시스템
handleGesture 메소드에서 다음과 같이 개선:
*/

const SPEED_PROFILES = {
  slow: 200,
  normal: 400,
  fast: 600,
  instant: 1000
};

switch (gestureType) {
  case 'fist':
    scrollAction = {
      action: 'SCROLL_UP',
      speed: SPEED_PROFILES.fast
    };
    break;

  case 'peace':
    scrollAction = {
      action: 'SCROLL_DOWN',
      speed: SPEED_PROFILES.normal
    };
    break;
}

/*
4. 제스처 히스토리 기반 스마트 필터링
getStableGesture 메소드 개선:
*/

getStableGesture() {
  if (this.gestureHistory.length < 2) {
    return this.gestureHistory[this.gestureHistory.length - 1]?.gesture || null;
  }

  // 최근 3개 중 2개 이상 동일한 제스처면 인정
  const recent = this.gestureHistory.slice(-3);
  const gestureCount = {};

  recent.forEach(item => {
    if (item.gesture) {
      gestureCount[item.gesture] = (gestureCount[item.gesture] || 0) + 1;
    }
  });

  // 가장 많이 나온 제스처 찾기
  const [stableGesture] = Object.entries(gestureCount)
    .sort(([,a], [,b]) => b - a)[0] || [null, 0];

  return stableGesture;
}

/*
5. 디버그 모드 추가
클래스 생성자에 추가:
*/

this.debugMode = true;  // 콘솔에 자세한 로그 출력

// onHandResults 메소드에서 사용
if (this.debugMode) {
  console.log('손 랜드마크:', landmarks.map(l => ({
    x: l.x.toFixed(3),
    y: l.y.toFixed(3)
  })));
  console.log('손가락 상태:', this.fingerStates);
  console.log('감지된 제스처:', gesture);
}

/*
6. 사용자 설정 시스템
popup.js에 설정 추가:
*/

function loadUserSettings() {
  chrome.storage.sync.get({
    sensitivity: 0.08,
    cooldown: 800,
    speed_profile: 'normal'
  }, (settings) => {
    // 설정 적용
    GESTURE_SENSITIVITY.finger_distance_threshold = settings.sensitivity;
    GESTURE_SENSITIVITY.gesture_cooldown = settings.cooldown;
  });
}

/*
테스트해보세요:
1. 이 예제들을 content.js에 하나씩 적용
2. test.html에서 테스트
3. 콘솔에서 결과 확인
4. 마음에 들면 더 개선하거나 새로운 아이디어 추가
*/

console.log('개선 예제 파일 로드됨 - content.js에 적용해서 테스트해보세요!');
