// Copyright 2015 Joyent, Inc.

var fast = require('../lib');
var test = require('tape').test;



////--- Globals

var PORT = process.env.TEST_PORT || 12345;

var client;
var server;

var enc_start = 0;
var enc_stop = 0;

var dec_start = 0;
var dec_stop = 0;

var res_q = [];

var advance = function () {
    while (res_q.length > 0) {
        var res = res_q.shift();

        res.end({});
    }
};


///--- Tests

test('hooks: setup', function (t) {
    server = fast.createServer({
        cbStartDecode: function () {
            dec_start++;
        },
        cbStopDecode: function () {
            dec_stop++;
        },
        cbStartEncode: function () {
            enc_start++;
        },
        cbStopEncode: function () {
            enc_stop++;
        }
    });
    server.rpc('testTiming', function (input, res) {
        res_q.push(res);
    });
    server.listen(PORT, function () {
        client = fast.createClient({
            host: 'localhost',
            port: PORT
        });
        client.on('connect', function () {
            t.end();
        });
    });
});

test('hooks: encode/decode hooks must be called appropriately', function (t) {
    t.plan(13);

    var msg = [];
    while (msg.length < 100000) {
        msg.push(Math.floor(Math.random() * 1000));
    }

    t.equal(dec_start, dec_stop);
    t.equal(dec_start, 0);

    t.equal(enc_start, enc_stop);
    t.equal(enc_start, 0);

    var req = client.rpc('testTiming', msg);
    t.ok(req);

    req.on('end', function () {
        t.equal(dec_start, dec_stop);
        t.ok(dec_start > 0);

        /*
         * Encode hooks should now have been called.
         */
        t.equal(enc_start, enc_stop);
        t.ok(enc_start > 0);

        t.end();
    });

    /*
     * Wait a bit, to show that no encoding is done until the server
     * sends a response:
     */
    setTimeout(function () {
        /*
         * Ensure that decode hooks have been called.
         */
        t.equal(dec_start, dec_stop);
        t.ok(dec_start > 0);

        /*
         * Ensure that encode hooks have not yet been called.
         */
        t.equal(enc_start, enc_stop);
        t.equal(enc_start, 0);

        /*
         * Release callbacks from server so that we get the reply.
         */
        advance();
    }, 250);
});

test('hooks: teardown', function (t) {
    var serverClosed = false;
    var clientClosed = false;
    function tryEnd() {
        if (serverClosed && clientClosed) {
            t.end();
        }
    }
    server.on('close', function () {
        serverClosed = true;
        tryEnd();
    });
    client.on('close', function () {
        clientClosed = true;
        tryEnd();
    });
    client.close();
    server.close();
});
