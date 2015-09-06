var argv = require('minimist')(process.argv.slice(2)),
    util = require('util'),
    instance = require('./instance'),
    Fiber = require('fibers'),
    shell = require('../utils/shell'),
    bunyan = require('../utils/bunyan')()

util.inherits(local, instance)
function local() {
  //TODO: check persistent
  bunyan.debug('[local] super call')
  instance.call(this)
  this.set('started', +new Date)
  this.set('status', 'unconfigured')

  this.set('address', process.env['MONGO_CLUSTER_ADDRESS'])
  this.set('cname', process.env['MONGO_CLUSTER_CNAME'])
  bunyan.debug('[local] checkout network')
  bunyan.debug({MONGO_CLUSTER_ADDRESS: process.env['MONGO_CLUSTER_ADDRESS'], MONGO_CLUSTER_CNAME: process.env['MONGO_CLUSTER_CNAME']}, 'Parsing env.')
  if ( ! process.env['MONGO_CLUSTER_ADDRESS'] )
    this.lookup(function(error) {
      if ( error ) {
        bunyan.fatal({cname: process.env['MONGO_CLUSTER_CNAME'], error: error}, 'Can not lookup local instance. Nor is there a address.')
        process.exit(2)
      }
    })
  else if ( /^https?/.test(process.env['MONGO_CLUSTER_ADDRESS']) ) {
    var http = require('http'),
        self = this, address = []

    bunyan.debug('[MONGO_CLUSTER_ADDRESS] resolve https? url.')
    http.get(process.env['MONGO_CLUSTER_ADDRESS'], function(res) {
      res.on('data', function(chunk){ bunyan.debug({chunk: chunk.toString() },'[MONGO_CLUSTER_ADDRESS] data.'); address.push(chunk) })
      res.on('end', function(){
        address = address.join('').toString()
        bunyan.debug({result: address}, '[MONGO_CLUSTER_ADDRESS] Http request successfull.')
        //TODO: move to utils...
        if ( /^(([0-9a-f]{0,4}:){1,7}[0-9a-f]{1,4}|([0-9]{1,3}\.){3}[0-9]{1,3})$/.test(address) )
          self.set('address', address)
        else {
          bunyan.fatal({address: address}, '[MONGO_CLUSTER_ADDRESS] Not valid address.')
          process.exit(2)
        }
      })
    }).on('error', function(e) {
      bunyan.fatal({error: e}, '[MONGO_CLUSTER_ADDRESS] Http request resolved into an error.')
      process.exit(2)
    })
  }
  bunyan.debug('[local] set _.argv')
  this.set('_.argv', argv)
  switch ( argv._[0] ) {
    case 'mongod':
      if ( argv['configsvr'] ) {
        bunyan.debug('[local] configsvr')
        this.set('type', 'configsvr')
        this.set('port', (argv['port'] ? argv['port'] : 27019))
      }
      else {
        bunyan.debug('[local] mongod')
        this.set('type', 'mongod')
        this.set('port', (
          argv['port'] ? argv['port'] : ( argv['shardsvr'] ? 27018 : 27017 ))
        )
      }

      break;
    case 'mongos':
      bunyan.debug('[local] mongos')
      this.set('type', 'mongos')
      this.set('port', (argv['port'] ? argv['port'] : 27017))
      break;
    default:
      bunyan.fatal({args: argv}, 'Can not figure out instance type.')
      process.exit(2)
  }

  bunyan.debug('[local] constructor finished.')
}

local.prototype.ready = function(cb) {
  var self = this
  // rough mathing of ipv4 + ipv6 //TODO: move to utils...
  if ( /^(([0-9a-f]{0,4}:){1,7}[0-9a-f]{1,4}|([0-9]{1,3}\.){3}[0-9]{1,3})$/.test(this.get('address')) )
    (cb || function() {})()
  else
    setTimeout(function() { self.ready(cb) }, 100)
}

// on local mashine get up to date data
local.prototype.get = function(key, args) {
  var self = this

  bunyan.debug('[local] get %s', key)
  if ( args !== false && /^_\.(?!argv)/.test(key) ) {
    bunyan.debug('[local] dyn call. Fiber for the win.', key)
    var fiber = Fiber.current
    shell.run(key+'.sh', {args: args}, function(err, result) {
      bunyan.debug({result: result}, '%s results!', key)
      if ( err ) bunyan.error({error: err}, '%s failed!', key)
      if ( result && typeof result[0] == 'object' )
        self.set(key, result[0])
      else {
        bunyan.fatal('%s failed!', key)
        process.exit(2)
      }

      fiber.run(result[0])
    })
    return Fiber.yield()
  }
  // Return data right away
  else {
    bunyan.debug({data: self.data[key]}, '[local] return %s right away.', key)
    //bunyan.debug({data: instance.prototype.get.call(this, key)}, '[local] return %s right away. SUPER?', key)
    return self.data[key]
  }
}

// singleton
module.exports = exports = new local
