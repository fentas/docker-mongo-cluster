var util = require('util'),
    bunyan = require('./bunyan')(),
    EventEmitter = require('events').EventEmitter,
    Fiber = require('fibers');
    require('fibers/future')

util.inherits(middleware, EventEmitter)
function middleware() {
  if ( !(this instanceof middleware) ) return new middleware

  EventEmitter.call(this)
}

middleware.prototype.on = function(event, cb) {
  bunyan.debug({arguments: arguments}, '[middleware - %s] on.', (typeof this))
  EventEmitter.prototype.on.call(this, event, function() {
    return cb.future().apply(this, arguments)
  })
}

module.exports = exports = middleware
