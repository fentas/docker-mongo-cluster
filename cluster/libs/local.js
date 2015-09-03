var argv = require('minimist')(process.argv.slice(2)),
    util = require('util'),
    instance = require('./instance'),
    Fiber = require('fibers'),
    shell = require('../utils/shell'),
    bunyan = require('../utils/bunyan')()

util.inherits(local, instance)
function local() {
  //TODO: check persistent
  instance.call(this)

  this.set('started', +new Date)
  this.set('status', 'unconfigured')

  this.set('address', process.env['MONGO_CLUSTER_ADDRESS'])
  this.set('cname', process.env['MONGO_CLUSTER_CNAME'])
  if ( ! process.env['MONGO_CLUSTER_ADDRESS'] )
    this.lookup(function(error) {
      if ( error )
        bunyan.fatal({cname: process.env['MONGO_CLUSTER_CNAME'], error: error}, 'Can not lookup local instance. Nor is there a address.')
    })

  this.set('_.argv', argv)
  switch ( argv._[0] ) {
    case 'mongod':
      if ( argv['configsvr'] ) {
        this.set('type', 'configsvr')
        this.set('port', (argv['port'] ? argv['port'] : 27019))
      }
      else {
        this.set('type', 'mongod')
        this.set('port', (
          argv['port'] ? argv['port'] : ( argv['shardsvr'] ? 27018 : 27017 ))
        )
      }

      break;
    case 'mongos':
      this.set('type', 'mongos')
      this.set('port', (argv['port'] ? argv['port'] : 27017))
      break;
    default:
      bunyan.fatal({args: argv}, 'Can not figure out instance type.')
      process.exit(2)
  }
}

// on local mashine get up to date data
local.prototype.get = function(key, args) {
  var self = this
  // Create a new fiber which yields data
  return Fiber(function() {
    if ( args !== false && /^_\.(?!argv)/.test(key) ) {
      shell.run(key+'.sh', {args: args}, function(err, result) {
        if ( err ) bunyan.error({error: err}, '%s failed!', key)
        if ( typeof result[0] == 'object' )
          self.set(key, result[0])

        Fiber.yield(result[0])
      })
    }
    // Return data right away
    else Fiber.yield(self.data[key])
  }).run()
}

// singleton
module.exports = exports = new local
