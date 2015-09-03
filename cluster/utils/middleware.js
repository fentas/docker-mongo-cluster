var util = require('util'),
    EventEmitter = require('events').EventEmitter

util.inherits(middleware, EventEmitter)
function middleware() {
  if ( !(this instanceof middleware) ) return new middleware

  EventEmitter.call(this)
}

module.exports = exports = middleware
