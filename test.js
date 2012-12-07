
var http = require('http');
var path = require('path');

var test = require('tap').test;
var filed = require('filed');
var director = require('director');

var Browser = require('./browser.js');

// Create a testing server
var router = new director.http.Router();
var server = http.createServer();
var chrome;

function fixturePath(name) {
    return path.resolve(__dirname, 'fixture', 'http-' + name + '.html');
}

function openPage(host, name, callback) {
    router.get('/' + name + '/set', function() {
        console.log('write' + name);
        this.req.pipe(filed(fixturePath(name))).pipe(this.res);
    });

    chrome.inspector.Page.navigate(host + '/' + name + '/set', function(err) {
        if (err) return callback(err);

        chrome.inspector.Console.once('messageAdded', function(data) {
            callback(null, data.message.text);
        });
    });
}

function prepear(callback) {
    server.on('request', router.dispatch.bind(router));
    server.listen(0, function() {
        var host = 'http://127.0.0.1:' + server.address().port;

        chrome = new Browser(function() {

            chrome.inspector.Console.enable(function(err) {
                if (err) return callback(err);

                chrome.inspector.Database.enable(function(err) {
                    if (err) return callback(err);

                    chrome.inspector.DOMStorage.enable(function(err) {
                        if (err) return callback(err);

                        callback(null, host);
                    });
                });
            });
        });
    });
}

prepear(function(err, host) {

    //TODO: reactivate this once the bug is found and solved
    test('local storage data imported', function(t) {
        openPage(host, 'local-storage', function(err, status) {
            t.equal(err, null);
            t.equal(status, 'done');
        });

        chrome.inspector.DOMStorage.once('addDOMStorage', function(info) {
            console.log('test:', info.storage.id);

            chrome.inspector.DOMStorage.getDOMStorageEntries(
                info.storage.id,
                function(err, info) {
                    t.equal(err, null);
                    console.log(info.entries);
                    t.equal(info.entries.length, 1);
                    t.end();
                }
            );
        });
    });

    test('local storage data removed', function(t) {
        chrome.clearState(function(err) {
            t.equal(err, null);

            openPage(host, 'local-storage', function(err, status) {
                    t.equal(err, null);
                    t.equal(status, 'done');
                }
            );

            chrome.inspector.DOMStorage.once('addDOMStorage', function(info) {
                console.log('test:', info.storage.id);

                chrome.inspector.DOMStorage.getDOMStorageEntries(
                    info.storage.id,
                    function(err, info) {
                        t.equal(err, null);
                        console.log(info.entries);
                        t.equal(info.entries.length, 1);
                        t.end();
                    }
                );
            });
        });
    });

    test('web SQL API data imported', function(t) {
        openPage(host, 'web-sql', function(err, status) {
            t.equal(err, null);
            t.equal(status, 'done');
        });

        chrome.inspector.Database.once('addDatabase', function(info) {

            chrome.inspector.Database.executeSQL(
                info.database.id,
                'SELECT * FROM todo',
                function(err, result) {
                    t.equal(err, null);
                    t.deepEqual(result.columnNames, [
                        'ID', 'todo', 'added_on'
                    ]);

                    t.equal(result.values.length, 3);

                    t.end();
                }
            );
        });
    });

    test('web SQL API data removed', function(t) {
        chrome.clearState(function(err) {
            t.equal(err, null);

            openPage(host, 'web-sql', function(err, status) {
                t.equal(err, null);
                t.equal(status, 'done');
            });

            chrome.inspector.Database.once('addDatabase', function(info) {

                chrome.inspector.Database.executeSQL(
                    info.database.id,
                    'SELECT * FROM todo',
                    function(err, result) {
                        t.equal(err, null);
                        t.deepEqual(result.columnNames, [
                            'ID', 'todo', 'added_on'
                        ]);

                        // In case webSQL clear dosn't work, this will be 6
                        t.equal(result.values.length, 3);

                        t.end();
                    }
                );
            });
        });
    });

    test('close chromium', function(t) {
        chrome.destory();
    });
});
