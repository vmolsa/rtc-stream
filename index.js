/*
 *  Copyright (c) 2015, vmolsa (MIT)
 *
 * API
 *  
 *   var rtc = new rtcStream([stream]) // returns Stream object
 *   
 *   rtc.write(data, encoding, callback)
 *   rtc.end(data, encoding, callback)
 *
 *   rtc.addStun('url', 'username', 'password')
 *   rtc.addTurn('url', 'username', 'password')
 *
 *   rtc.useAudio(boolean);
 *     - enables / disables for receiving audio stream
 *     - default: disabled
 *     - on media webrtc connection: enabled
 *
 *   rtc.useVideo(boolean);
 *     - enables / disables for receiving video stream
 *     - default: disabled
 *     - on media webrtc connection: enabled
 *
 *   rtc.onChannel('channelName', callback(channel))
 *   rtc.offChannel('channelName');
 *
 *   rtc.createMedia([options], [callback(media)])
 *     - Opens another webrtc stream by using primary webrtc connection for signaling.
 *     - defaults on media is useAudio(true) and useVideo(true) 
 *       rest of settings are inherits with primary webrtc stream.
 *
 *   rtc.createChannel(['channelName'], [callback(channel)], [timeout])
 *     - Opens webrtc datachannel
 *     - on success 'channel' / callback is called with channel object.
 *     - on error media / primary webrtc stream 'error' event is called with Error object and callback is called with null.
 *
 *   rtc.createStream([options], [callback(stream)])
 *     - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia
 *     - on success 'stream' / callback is called with stream object.
 *     - on error media / primary webrtc stream 'error' event is called with Error object and callback is called with null.
 *
 *   rtc.addStream(stream)
 *     - add audio / video stream to webrtc.
 *     - both ends must have audio or video enabled using useAudio(true) / useVideo(true)
 *
 *   rtc.removeStream(stream) 
 *     - removes stream from webrtc connection
 *
 *   rtc.getLocalStreams()
 *     - returns array of active audio / video local streams.
 *
 *   rtc.getRemoteStreams()
 *     - returns array of active audio / video remote streams.
 *
 * EVENTS
 *
 *  'error', callback(error)
 *  'close', callback()
 *  'end',   callback()
 *
 *  'media', callback(media)
 *  'channel', callback(channel)
 *
 * Datachannel Prototype
 *   - http://nodejs.org/api/stream.html
 */

'use strict';

(function() {
  var _ = require('underscore');
  var native_emitter = require('events').EventEmitter;
  var native_stream = require('stream');
  var native_buffer = null;

  var _RTCPeerConnection = null;
  var _RTCIceCandidate = null;
  var _RTCSessionDescription = null;
  var _getUserMedia = null;
  var _isBrowser = false;
  
  try {
    native_buffer = Buffer;    
  } catch (ignored) { }

  if (!native_buffer) {
    native_buffer = require('buffer');
  }
  
  if (typeof(window) !== 'undefined' && typeof(navigator) !== 'undefined') {
    _isBrowser = true;
  }

  if (_isBrowser) {
    _RTCPeerConnection = (window.mozRTCPeerConnection || window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection).bind(window);
    _RTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate).bind(window);
    _RTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription).bind(window);
    _getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia).bind(navigator);
  } else {
    var WRTC = require('wrtc');
    _RTCPeerConnection = WRTC.RTCPeerConnection;
    _RTCIceCandidate = WRTC.RTCIceCandidate;
    _RTCSessionDescription = WRTC.RTCSessionDescription;
  }
  
  function emitError(self, name, message) {
    var error = null;
    
    if (_.isString(name)) {
      error = new Error();

      if (message) {
        error.message = message;
      }

      error.name = name;
    } else if (name instanceof Error) {
      error = name;
    }
    
    if (_.isObject(error)) {
      if (native_emitter.listenerCount(self, 'error')) {
        return self.emit('error', error);
      }
    
      throw error;    
    }
  }
 
  function Datachannel(socket) {
    native_stream.Stream.call(this);
    
    this._socket = socket;
    this._encoding = 'buffer';
    this.writable = true;
    this.readable = true;
  }
  
  _.extend(Datachannel.prototype, native_stream.prototype);

  Datachannel.prototype.setEncoding = function(encoding) {
    if (_.isString(encoding)) {
      this._encoding = encoding;  
    }
  };
  
  Datachannel.prototype.write = function(msg, encoding, callback) {
    var self = this;
    var data = null;
    var socket = self._socket;

    if (socket) {
      if (_.isFunction(encoding)) {
        callback = encoding;
        encoding = null;
      }

      if (native_buffer.isBuffer(msg)) {
        data = msg;
      } else {
        if (_.isString(msg)) {
          data = new native_buffer(msg, encoding);
        } else {
          data = new native_buffer(JSON.stringify(msg));
        }
      }
      
      try {
        socket.send(new Uint8Array(data));
      } catch (error) {
        emitError(self, error);
        self.end();
      }
      
      if (_.isFunction(callback)) {
        callback();
      } 
    } else {
      emitError(self, 'Not Connected!');
    }
  };
  
  Datachannel.prototype.end = function(msg, encoding, callback) {
    var self = this;
    var socket = self._socket;

    if (_.isFunction(encoding)) {
      callback = encoding;
      encoding = null;
    }  

    if (msg) {
      return self.write(msg, encoding, function() {
        self.end(null, null, callback);
      });
    }
    
    if (socket) {
      socket.close();
      self._socket = null;
    } else {
      self.emit('finish');
      self.emit('end');
      self.emit('close');
      self.removeAllListeners();    
    }

    if (_.isFunction(callback)) {
      callback();
    }
  };
  
  function writeToSocket(self, event, data) {    
    var packet = {
      type: event,
      data: data
    };

    var buf = new native_buffer(JSON.stringify(packet));
    
    if (self._encoding !== 'buffer') {
      self.emit('data', buf.toString(self._encoding));
    } else {
      self.emit('data', buf);
    }
  }
  
  function createPeer(self) {  
    var peer = new _RTCPeerConnection(self.servers, self.options);

    self._state = peer.signalingState;
    self.closed = false;
    self.connecting = false;

    peer.onsignalingstatechange = function() {
      var state = peer.signalingState;
      
      if (self._state !== state && !self.connecting) {
        self.connecting = true;
      }
      
      switch (state) {
        case 'stable':
          if (!self.connected && self._state !== 'stable') {
            self.connecting = false;
            self.connected = true;
            self.emit('open');
          }
          
          break;
        case 'closed':
          self.connecting = false;
          self.connected = false;
          self._peer = null;
          self.end();
          
          break;
        default:
          break;
      }
      
      self._state = state;
    };

    peer.onicecandidate = function(event) {
      if (_.isObject(event) && _.isObject(event.candidate)) {
        switch (event.candidate.sdpMid) {
          case 'audio':
            if (!self.constraints.mandatory.OfferToReceiveAudio) {
              return;
            }

            break;
          case 'video':
            if (!self.constraints.mandatory.OfferToReceiveVideo) {
              return;
            }

            break;
          default:
            break;
        }

        writeToSocket(self, 'iceCandidate', event.candidate);
      }
    };

    peer.ondatachannel = function(event, callback, timeout) {      
      var dc = event.channel || event;
      
      if (!_.isObject(dc)) {
        return emitError(self, 'invalid Datachannel');
      }
      
      var label = dc.label || 'channel';
      
      if (label === 'undefined') {
        label = 'channel';
      }
      
      if (!native_emitter.listenerCount(self, 'channel') &&
          !_.isFunction(self._onChannel[label]) && 
          !_.isFunction(callback))
      {
        if (label !== '_media' || !native_emitter.listenerCount(self, 'media')) {
          dc.close();
          return false;
        }
      }
      
      var channel = new Datachannel(dc);
      
      dc.binaryType = 'arraybuffer';
      
      var timer = null;
      
      if (_.isNumber(timeout)) {
        timer = setTimeout(function() {
          channel.end();
          
          if (_.isFunction(callback)) {
            callback(null);
            callback = null;
          }
        }, timeout);
      }
      
      dc.onclose = function(event) {
        clearTimeout(timer);
        
        channel._socket = null;
        channel.end();
        
        if (_.isFunction(callback)) {
          callback(null);
          callback = null;
        }
      };
      
      dc.onerror = function(event) {
        emitError(channel, event);
      };
      
      dc.onopen = function(event) {
        clearTimeout(timer);
        
        if (label === '_media') {
          if (!_.isFunction(callback)) {
            var media = new rtcStream(channel);
            
            media.servers = self.servers;
            media.options = self.options;

            media.useAudio(true);
            media.useVideo(true);

            self.emit('media', media);
          }
        } else {
          self.emit('channel', channel);
          
          if (_.isFunction(self._onChannel[label])) {
            self._onChannel[label].call(self, channel);
          }
        }
        
        if (_.isFunction(callback)) {
          callback(channel);
          callback = null;
        }
      };
      
      dc.onmessage = function(event) {
        var packet = event.data || event;
        
        if (!native_buffer.isBuffer(packet)) {
          if (_.isString(packet)) {
            packet = new native_buffer(packet);
          } else if (_.isObject(packet) && packet.type === 'Buffer' && packet.data) {
            packet = new native_buffer(packet.data);
          } else if (packet instanceof ArrayBuffer) {
            packet = new native_buffer(new Uint8Array(packet));
          } else if (_.isArray(packet)) {
            packet = new native_buffer(packet);
          } else {
            return self.end();
          }
        }
        
        if (channel._encoding !== 'buffer') {
          channel.emit('data', packet.toString(channel._encoding));
        } else {
          channel.emit('data', packet);
        }
      };
    };

    peer.onnegotiationneeded = function(event) {
      createOffer(self);
    };
    
    peer.onaddstream = function(event) {
      var stream = event.stream;
     
      if (stream) {
        self.emit('stream', stream);
      }
    };
    
    self._peer = peer;
  }
  
  function getPeer(self) {
    if (!self._peer) {
      createPeer(self);
      return getPeer(self);
    }
    
    return self._peer;
  }
  
  function setLocalDescription(self, sdp) {
    var peer = getPeer(self);
    
    if (!_.isObject(sdp)) {
      return emitError(self, 'invalid LocalDescription');
    }
    
    peer.setLocalDescription(sdp, function() {
      if (peer.signalingState == 'have-local-offer') {
        writeToSocket(self, 'offer', sdp);
      } else {
        writeToSocket(self, 'answer', sdp);
      }
    }, function(error) {
      emitError(self, error);
    });
  }
  
  function createOffer(self) {
    var peer = getPeer(self);

    if (!self.connecting) {
      self.connecting = true;

      peer.createOffer(function(sdp) {
        setLocalDescription(self, sdp);
      }, function (error) {
        emitError(self, error);
      }, self.constraints);
    }
  }
  
  function createAnswer(self) {
    var peer = getPeer(self);

    peer.createAnswer(function(sdp) {
      setLocalDescription(self, sdp);
    }, function (error) {
      emitError(self, error);
    }, self.constraints);
  }
  
  function setRemoteDescription(self, sdp) {
    var peer = getPeer(self);
    
    peer.setRemoteDescription(sdp, function() {
      if (peer.signalingState == 'have-remote-offer') {
        createAnswer(self);
      }
    }, function(error) {
      emitError(self, error);
    }, self.constraints);
  }
  
  function setOffer(self, offer) {
    setRemoteDescription(self, new _RTCSessionDescription(offer));
  }
  
  function setAnswer(self, answer) {
    setRemoteDescription(self, new _RTCSessionDescription(answer));
  }

  function setIceCandidate(self, iceCandidate) {
    var peer = getPeer(self);

    switch (peer.iceConnectionState) {
      case 'new':
      case 'checking':
      case 'connected':
        var newIce = new _RTCIceCandidate(iceCandidate);
        
        switch (newIce.sdpMid) {
          case 'audio':
            if (!self.constraints.mandatory.OfferToReceiveAudio) {
              return;
            }

            break;
          case 'video':
            if (!self.constraints.mandatory.OfferToReceiveVideo) {
              return;
            }

            break;
          default:
            break;
        }

        peer.addIceCandidate(newIce, function() {

        }, function(error) {
          emitError(self, error);
        });
      case 'completed':
        break;
      default:
        emitError(self, 'unknown iceConnectionState');
        self.end();
    }
  }
  
  function rtcStream(socket) {
    var self = this;
    native_stream.call(self);
    
    self.connected = false;
    self.connecting = false;
    self.closed = false;
    self.writable = true;
    self.readable = true;

    self.constraints = {
      mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
      }
    };

    self.servers = {
      iceServers: []
    };
    
    self.options = {
      optional: [
        { DtlsSrtpKeyAgreement: true }
      ]
    };
    
    self._onChannel = {};
    self._encoding = 'buffer';
    self._peer = null;
    self._state = null;
    
    if (_.isObject(socket) && _.isFunction(socket.pipe)) {
      socket.pipe(self).pipe(socket);
    }
  }
  
  _.extend(rtcStream.prototype, native_stream.prototype);
  
  if (!_.isFunction(rtcStream.prototype.off)) {
    rtcStream.prototype.off = rtcStream.prototype.removeListener;
  }
  
  rtcStream.prototype.write = function(packet, encoding, callback) {
    var self = this;
    var data = null;
    
    if (_.isFunction(encoding)) {
      callback = encoding;
      encoding = 'utf8';
    }

    if (!native_buffer.isBuffer(packet)) {
      if (_.isString(packet)) {
        packet = new native_buffer(packet, encoding);
      } else if (_.isObject(packet) && packet.type === 'Buffer' && packet.data) {
        packet = new native_buffer(packet.data);
      } else if (packet instanceof ArrayBuffer) {
        packet = new native_buffer(new Uint8Array(packet));
      } else if (_.isArray(packet)) {
        packet = new native_buffer(packet);
      } else {
        emitError(self, 'invalid packet');
        return self.end();
      }
    }
    
    try {
      data = JSON.parse(packet.toString('utf8')); 
    } catch(ignored) {
      emitError(self, 'invalid data');
      return self.end();
    }
    
    if (_.isObject(data) && _.isString(data.type) && _.isObject(data.data)) {
      switch (data.type) {
        case 'offer':
          setOffer(self, data.data);
          
          break;
        case 'answer':
          setAnswer(self, data.data);
          
          break;
        case 'iceCandidate':
          setIceCandidate(self, data.data);
          
          break;
        default:
          self.end();
          break;
      }
    } else {
      emitError(self, 'invalid data');
      self.end();
    }
    
    if (_.isFunction(callback)) {
      callback();
    }
  };
  
  rtcStream.prototype.destroy = function() {
    this.removeAllListeners();
  };
  
  rtcStream.prototype.end = function(msg, encoding, callback) {
    var self = this;
    
    if (_.isFunction(encoding)) {
      callback = encoding;
      encoding = null;
    }  

    if (msg) {
      return self.write(msg, encoding, function() {
        self.end(null, null, callback);
      });
    }
    
    if (self._peer) {
      self._peer.close();
      self._peer = null;
    } else {
      if (!self.closed) {
        self.closed = true;
        
        self.emit('finish');
        self.emit('end');
        self.emit('close');
      }
    } 

    if (_.isFunction(callback)) {
      callback();
    }
  };
  
  rtcStream.prototype.setEncoding = function(encoding) {
    var self = this;
    
    if (_.isString(encoding)) {
      if (native_buffer.isEncoding(encoding) || encoding == 'buffer') {
        self._encoding = encoding;
        
        return encoding;
      }
    }
    
    return false;
  };
  
  rtcStream.prototype.addStun = function(url, user, credential) { 
    if (_.isString(url)) {
      var stun = {
        url: 'stun:' + url
      };
      
      if (_.isString(user)) {
        stun.username = user;
      }
      
      if (_.isString(credential)) {
        stun.credential = credential;
      }
      
      this.servers.iceServers.push(stun);
    }
  }
  
  rtcStream.prototype.addTurn = function(url, user, credential) {
    if (_.isString(url)) {
      var turn = {
        url: 'turn:' + url
      };
      
      if (_.isString(user)) {
        turn.username = user;
      }
      
      if (_.isString(credential)) {
        turn.credential = credential;
      }
      
      this.servers.iceServers.push(turn);
    }
  }
  
  rtcStream.prototype.useAudio = function(value) {
    this.constraints.mandatory.OfferToReceiveAudio = value ? true : false;
  };
  
  rtcStream.prototype.useVideo = function(value) {
    this.constraints.mandatory.OfferToReceiveVideo = value ? true : false;
  };
  
  rtcStream.prototype.createMedia = function(callback, timeout) {
    var self = this;
    
    if (!_.isFunction(callback) && native_emitter.listenerCount(self, 'media')) {
      callback = function(media) {
        if (media) {
          self.emit('media', media);
        }
      };
    }
    
    if (_.isFunction(callback)) {
      self.createChannel('_media', function(transport) {
        if (!transport) {
          return callback(null);
        }
        
        var media = new rtcStream(transport);
        
        media.servers = self.servers;
        media.options = self.options;
        
        media.useAudio(true);
        media.useVideo(true);
        
        callback(media);
      }, timeout);
    } else {
      emitError(self, 'No Media listener');
    }
  };
  
  rtcStream.prototype.createChannel = function(label, callback, timeout) {
    var self = this;
    var peer = getPeer(self);

    if (_.isFunction(label)) {
      if (_.isNumber(callback)) {
        timeout = callback;
      }
      
      callback = label;
      label = null;
    }

    peer.ondatachannel(peer.createDataChannel(label), callback, timeout);
    
    if (!self.connecting) {
      createOffer(self);
    }    
  };
  
  rtcStream.prototype.onChannel = function(event, callback) {
    if (_.isString(event) && _.isFunction(callback)) {
      this._onChannel[event] = callback;
    }
  };
  
  rtcStream.prototype.offChannel = function(event) {
    if (_.isString(event) && this._onChannel[event]) {
      delete this._onChannel[event];
    }
  };
  
  rtcStream.prototype.addStream = function(stream) {
    var self = this;
    var peer = getPeer(self);
    
    peer.addStream(stream);
  };
  
  rtcStream.prototype.removeStream = function(stream) {
    var self = this;
    var peer = getPeer(self);
    
    peer.removeStream(stream);
  };
  
  rtcStream.prototype.getLocalStreams = function(stream) {
    var self = this;
    var peer = getPeer(self);
    
    return peer.getLocalStreams(stream);
  };

  rtcStream.prototype.getRemoteStreams = function(stream) {
    var self = this;
    var peer = getPeer(self);
    
    return peer.getRemoteStreams(stream);
  };

  rtcStream.prototype.createStream = function(options, callback) {
    var self = this;
    
    if (_.isFunction(options)) {
      callback = options;
      options = null;
    }
    
    if (!_.isFunction(callback) && native_emitter.listenerCount(self, 'stream')) {
      callback = function(stream) {
        if (stream) {
          self.emit('stream', stream);
        }
      };
    }
    
    if (!_.isObject(options)) {
      options = {
        audio: true,
        video: {
          mandatory: {
            minWidth: 320,
            maxWidth: 1280,
            minHeight: 180,
            maxHeight: 720,
            minFrameRate: 30
          }
        }
      };
    }
  
    if (_getUserMedia) {
      if (_.isFunction(callback)) {
        _getUserMedia(options, function(stream) {
          callback(stream);
        }, function(error) {
          emitError(self, error);
          callback(null);
        });
      } else {
        emitError(self, 'No Stream listener');
      }
    } else {
      if (_.isFunction(callback)) {
        callback(null);
      }
    }
  };
  
  if (_isBrowser) {
    window.rtcStream = rtcStream;
  } else {
    module.exports = rtcStream;
  }
})();