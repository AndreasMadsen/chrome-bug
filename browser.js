
var util = require('util');
var events = require('events');
var spawn = require('child_process').spawn;
var path = require('path');

var async = require('async');
var inspector = require('inspector');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

var chromium = 'google-chrome';
if (require('os').platform() === 'darwin') {
    chromium = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

function Browser(callback) {
    var self = this;

    this.inspector = null;
    this.process = null;
    this.userDir = null;
    this.connection = null;
    this.callback = null;

    var relayError = function(err) {
        self.emit('error', err);
    };

    async.series([
        function (done) {
            var server = new WebSocketServer({port: 6660});
            server.once('connection', function(connection) {
                self.connection = connection;
                connection.on('message', self._onMessage.bind(self));
                self.emit('connection', connection);
            });

            done(null);
        },

        function startupChromium(done) {
            // create custom chromium arguments object
            var args = [
                'about:blank',
                '--no-first-run',
                '--remote-debugging-port=6661',
                '--user-data-dir=' + path.resolve(__dirname, 'chrome'),
                '--load-extension=' + path.resolve(__dirname, 'extension')
            ];

            // spawn a chromium process
            self.process = spawn(chromium, args);

            done(null);
        },

        // wait for the extension (defined previous) to connect
        function connectExtension(done) {
            if (self.connection) return done();
            self.once('connection', function() { done(null); });
        },

        function openInspector(done) {
            // connect to webkit inspector
            self.inspector = inspector(6661, '127.0.0.1', 'about:blank');
            self.inspector.once('connect', done);
        }

    ], callback);
}
module.exports = Browser;
util.inherits(Browser, events.EventEmitter);

Browser.prototype._onMessage = function(message) {
    this.callback(null);
    this.callback = null;
};

Browser.prototype.clearState = function(callback) {
    this.callback = callback;
    this.connection.send('clear');
};

Browser.prototype.destory = function() {
    var self = this;

    // done, emit close
    self.process.kill();
    process.exit(0);
};
