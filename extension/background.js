var connection = new WebSocket('ws://localhost:6660');

connection.onmessage = function(e) {
    window.chrome.browsingData.remove({}, {
        'cookies': true,
        'fileSystems': true,
        'indexedDB': true,
        'webSQL': true,
        'localStorage': true
    }, function () {
        connection.send('done');
    });
};
