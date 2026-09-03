/**
 * Manual Jest mock for @vapi-ai/react-native.
 *
 * The real package pulls in native WebRTC modules that don't exist in the
 * Jest environment, so tests never want the real thing. This mock is a
 * plain event emitter that records start()/stop() calls and lets tests
 * drive the same events the real SDK would emit ('call-start', 'message',
 * 'call-end', ...) via __getLastInstance().
 */
const {EventEmitter} = require('events');

let lastInstance = null;

class MockVapi extends EventEmitter {
  constructor(publicKey) {
    super();
    this.publicKey = publicKey;
    this.startCalls = [];
    this.stopCalls = 0;
    lastInstance = this;
  }

  start(assistant) {
    this.startCalls.push(assistant);
    return Promise.resolve();
  }

  stop() {
    this.stopCalls += 1;
  }

  setMuted() {}

  isMuted() {
    return false;
  }
}

module.exports = MockVapi;
module.exports.default = MockVapi;
module.exports.__getLastInstance = () => lastInstance;
