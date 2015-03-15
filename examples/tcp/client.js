var net = require('net');
var rtcStream = require('../../index.js');

var socket = net.connect({ host: 'localhost', port: 1337 }, function() {
  socket.setNoDelay(true);
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
    channel.setEncoding('utf8');
    
    channel.on('data', function(data) {
      console.log(data);
      channel.end();
    });
  
    channel.on('error', function(error) {
      console.log('Channel error:', error.toString());
    });

    channel.on('end', function() {
      console.log('Channel closed :(');
      rtc.end();
    });

    channel.write('HELLO SERVER!\n');
  });
});