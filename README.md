# WebRTC Stream

Webrtc P2P through regular NodeJS stream

# Client Example

``````````
var net = require('net');
var rtcStream = require('rtc-stream');

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
``````````

# Server Example

``````````
var net = require('net');
var rtcStream = require('rtc-stream');

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
``````````

# Examples

https://github.com/vmolsa/rtc-stream/tree/master/examples

# Prototype

``````````
  var rtc = new rtcStream([stream]) // returns Stream object

   rtc.write(data, encoding, callback)
   rtc.end(data, encoding, callback)

   rtc.addStun('url', 'username', 'password')
   rtc.addTurn('url', 'username', 'password')
 
   rtc.useAudio(boolean);
     - enables / disables for receiving audio stream
     - default: disabled
     - on media webrtc connection: enabled

   rtc.useVideo(boolean);
     - enables / disables for receiving video stream
     - default: disabled
     - on media webrtc connection: enabled

   rtc.onChannel('channelName', callback(channel))
   rtc.offChannel('channelName');

   rtc.createMedia([options], [callback(media)])
     - Opens another webrtc stream by using primary webrtc connection for signaling.
     - defaults on media is useAudio(true) and useVideo(true) 
       rest of settings are inherits with primary webrtc stream.
 
   rtc.createChannel(['channelName'], [callback(channel)], [timeout])
     - Opens webrtc datachannel
     - on success 'channel' / callback is called with channel object.
     - on error media / primary webrtc stream 'error' event is called with Error object and 
         callback is called with null.
 
   rtc.createStream([options], [callback(stream)])
     - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia
     - on success 'stream' / callback is called with stream object.
     - on error media / primary webrtc stream 'error' event is called with Error object and 
       callback is called with null.
 
   rtc.addStream(stream)
     - add audio / video stream to webrtc.
     - both ends must have audio or video enabled using useAudio(true) / useVideo(true)

   rtc.removeStream(stream) 
     - removes stream from webrtc connection

   rtc.getLocalStreams()
     - returns array of active audio / video local streams.

   rtc.getRemoteStreams()
     - returns array of active audio / video remote streams.
``````````
# Events

``````````
  'error', callback(error)
  'close', callback()
  'end',   callback()

  'media', callback(media)
  'channel', callback(channel)
``````````

# Datachannel Prototype

http://nodejs.org/api/stream.html

# License

MIT
