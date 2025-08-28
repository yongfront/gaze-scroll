// 도움말 페이지 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // 뒤로가기 버튼 이벤트 핸들러
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // 확장 프로그램 팝업으로 돌아가기 시도
                window.close();
            }
        });
    }
});
