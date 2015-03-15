var net = require('net');
var rtcStream = require('../../index.js');
var restStream = require('rest-stream');

var socket = net.connect({ host: 'localhost', port: 1337 }, function() {
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
  
  rtc.createChannel('echo', function(channel) {
    var rest = new restStream(channel);
    
    rest.on('end', function() {
      rtc.end();
    });
    
    rest.on('error', function(error) {
      rtc.emit('error', error);
    });
    
    rest.newRequest('print', 'Hello World!');
  
    rest.newRequest('concat', 'Hello', 'World', 12345, function(reply) {
      console.log(reply);  
    
      setTimeout(function() {
        rest.end();
      }, 5000);
    });
  });
});