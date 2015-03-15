var net = require('net');
var rtcStream = require('../../index.js');
var restStream = require('rest-stream');

var server = net.createServer(function(socket) {
  var rtc = new rtcStream(socket);

  rtc.addStun('stun.l.google.com:19302');

  rtc.on('end', function() {
    console.log('Peer closed :(');
  });

  rtc.on('error', function(error) {
    console.log('Peer error:', error.toString());
  });

  rtc.on('open', function() {
    console.log('Peer Connected :)');
  });

  rtc.on('channel', function(channel) {
    var rest = new restStream(channel);
    
    rest.on('end', function() {
      rtc.end();
    });
    
    rest.on('error', function(error) {
      rtc.emit('error', error);
    });
    
    rest.onRequest('print', function(data) {
      console.log(data);
    });
    
    rest.onRequest('concat', function(arg1, arg2, arg3, callback) {
      var res = arg1 + arg2 + arg3;

      console.log('Concat:', res);
      callback(res);
    });
  });
  
  socket.on('end', function() {
    console.log('Disconnected...');
  });
});

server.listen({
  host: 'localhost',
  port: 1337,
});
