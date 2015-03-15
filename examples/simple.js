var rtcStream = require('../index.js');

var alice = new rtcStream();
var bob = new rtcStream(alice);

alice.addStun('stun.l.google.com:19302');
bob.addStun('stun.l.google.com:19302');

alice.on('end', function() {
  console.log('alice: peer closed :(');
});

alice.on('error', function(error) {
  console.log('alice error:', error.toString());
});

alice.on('open', function() {
  console.log('alice: Connected :)');
});

bob.on('end', function() {
  console.log('bob: peer closed :(');
});

bob.on('error', function(error) {
  console.log('bob error:', error.toString());
});

bob.on('open', function() {
  console.log('bob: Connected :)');
});

bob.onChannel('helloStream', function(channel) {
  console.log('bob: got channel:', ':)');
  
  channel.pipe(process.stdout);
  
  channel.on('error', function(error) {
    console.log('bob channel error:', error.toString());
  });
  
  channel.on('end', function() {
    console.log('bob: channel closed :(');
    bob.end();
  });
  
  channel.write('Hello Alice!\n');
});

alice.createChannel('helloStream', function(channel) {
  if (channel) {
    console.log('alice: got channel:', ':)');

    channel.pipe(process.stdout);

    channel.on('error', function(error) {
      console.log('alice channel error:', error.toString());
    });

    channel.on('end', function() {
      console.log('alice: channel closed :(');
      alice.end();
    });

    channel.write('Hello Bob!\n');
    
    setTimeout(function() {
      channel.end();
    }, 5000);
  } else {
    console.log('Timeout');
    alice.end();
  }
}, 5000);
