var argv = require('minimist')(process.argv.slice(2)),
    dgram = require("dgram"),
    dns = require('dns'),
    udp = dgram.createSocket("udp4"),
    bunyan = require('../utils/bunyan')()


function instance(host, type) {
  this.data = {}

  if ( typeof host !== 'undefined' ) {
    this.set('type', type)

    var self = this

    if ( typeof host === 'string' )
      host = host.split(':').map(function(data) { return {address: data[0], port: data[1]} })

    if ( /^(\d{1,3}\.?){4}$/.test(host.address) )
      this.set('address', host.address)
    else
      this.set('cname', host.address)

    this.set('port', host.port)
  }
}

instance.prototype.lookup = function(cb) {
  var cb = cb || function() {},
      self = this

  dns.lookup(this.get('cname') || this.get('address'), 4, function(error, address, family) {
    cb.apply(self, arguments)
    if ( error ) {
      bunyan.error({instance: self.toString(), error: error}, 'Could not lookup instance.')
      return
    }

    self.set('address', address)
  })
}

instance.prototype.ping = function(cb) {
  bunyan.debug({tries: tries}, 'Ping.')
  this.emit('ping', this.toJSON())

  var tries = 0,
      self = this
  var pong = function() {
    if ( typeof self.get('status') !== 'undefined' ) return cb.apply(self, [])


    if ( ++tries > process.env['MONGO_CLUSTER_RETRIES'] ) {
      bunyan.error({instance: self.toString()}, 'Instance did not responed.')

      self.set('status', null)
    }
    else {
      bunyan.debug({tries: tries}, 'Retry ping.')

      self.emit('ping', self.toJSON())
      setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])
    }
  }
  setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])
}

instance.prototype.emit = function(event) {
  var msg = {
    "event": event,
    "type": this.get('type'),
    "args": arguments.slice(1)
  }
  msg = new Buffer(JSON.stringify(msg))
  bunyan.debug({msg: msg, address: this.address, port: process.env['MONGO_CLUSTER_UDP_PORT']}, 'udp send.')

  udp.send(msg, 0, msg.length, this.address, process.env['MONGO_CLUSTER_UDP_PORT'])
}

instance.prototype.getFullAddress = function() {
  return (
    (this.get('cname') || this.get('address')) + ':' + this.get('port')
  ).replace(/:$/, '')
}

instance.prototype.toString = function() {
  return this.get('dns') + '/' + this.get('address') + ':' + this.get('port')
}

instance.prototype.set = function(data, value) {
  if ( typeof data == 'object' ) {
    return extend(this.data, data)
  }
  return this.data[data] = value
}
instance.prototype.get = function(key) {
  return this.data[key]
}

instance.prototype.toJSON = function() {
  return JSON.stringify(this.data, function(key, value) {
    // strip privates
    // if ( ! /^_[^\.]/.test(key) ) return value
  })
}

module.exports = exports = instance
