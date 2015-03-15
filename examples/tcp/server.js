var net = require('net');
var rtcStream = require('../../index.js');

var server = net.createServer(function(socket) {
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

  rtc.on('channel', function(channel) {
    channel.pipe(process.stdout);
  
    channel.on('error', function(error) {
      console.log('Channel error:', error.toString());
    });

    channel.on('end', function() {
      console.log('Channel closed :(');
      rtc.end();
    });

    channel.write('EHLO FROM SERVER!\n');
  });
  
  socket.on('end', function() {
    console.log('Disconnected...');
  });
});

server.listen({
  host: 'localhost',
  port: 1337,
});
