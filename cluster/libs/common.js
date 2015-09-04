var udp = require('../utils/udp'),
    middleware = require('../utils/middleware'),
    Instance = require('./instance'),
    local = require('./local'),
    util = require('util'),
    dns = require('dns'),
    bunyan = require('../utils/bunyan')()

util.inherits(common, middleware)
function common() {
  this.configsvr = []
  this.mongod = []
  this.mongos = []
  this.count = 0
}

common.prototype.addInstance = function(host, type) {
  var inst = new Instance(host, type)
  this[type].push(inst)
  return inst
}

common.prototype.getInstances = function(type) {
  bunyan.debug({instances:this[type], type: type}, 'Get instances.')
  return this[type].filter(function(instance) {
    // remove not reachable instances
    bunyan.debug({instance:instance}, 'Check instance status.')
    if ( instance.get('status') )
      return true
  })
}

common.prototype.lookupMongoCluster = function(itype) {
  bunyan.debug({MONGO_CLUSTER_INSTANCES: process.env['MONGO_CLUSTER_INSTANCES']}, 'lookup env.');

  [
    process.env['MONGO_CLUSTER_CONFIGSVR'],
    process.env['MONGO_CLUSTER_MONGOD'],
    process.env['MONGO_CLUSTER_MONGOS']
  ]
  .forEach(function resolve(env, z) {
    if ( ! env ) return;

    var type = ['configsvr', 'mongod', 'mongos'][z],
        self = this,
        list = env,
        instances = null,

        count = 0,
        pongCount = 0,

        pong = function() {
          bunyan.debug('Instance %s of %s loaded.', pongCount+1, count)
          if ( ++pongCount == count ) {
            bunyan.info('Pong complete.')
            itype.emit ? itype.emit('_initialize') : itype()
          }
        }

    // reset list
    self[type] = []

    if ( /^https?/.test(list) ) {
      bunyan.debug({list: list}, 'Recognized MONGO_CLUSTER_INSTANCES as http url.')

      var http = require('http'),
          callee = (resolve || arguments.callee),
          body = []

      http.get(list, function(res) {
        res.on('data', function(chunk){
            body.push(chunk);
        })
        res.on('end', function(){
          body = body.join('').toString()
          bunyan.debug({result: body}, 'Http request successfull.')
          callee(body, z)
        })
      }).on('error', function(e) {
        bunyan.error({error: e}, 'Http request resolved into an error.')
      })

      return
    }
    /*else if ( /^#/.test(list) ) {
      bunyan.debug({list: list}, 'Recognized MONGO_CLUSTER_INSTANCES as bash script.')

      list = exec(list.substr(1))
      if ( list.code !== 0 ) bunyan.error({shell: list}, 'bash script returned error code.')
      instances = list.output
    }*/
    else instances = list

    if ( instances && /^(.+,?)+$/.test(instances) ) { //\d{3}\.\d{3})\.\d{3}\.\d{3}
      bunyan.debug({instances: instances}, 'Got mongo instance list.')

      instances = instances.split(',')
      count = instances.length

      for ( var i = 0 ; i < instances.length ; i++ ) {
        if ( ! instances[i] ) continue

        (function(instance_address) {
          bunyan.debug({instance: instance_address}, 'Resolve A records.')

          dns.resolve(instance_address.split(':')[0], 'A', function(error, addresses) {
            if ( error ) {
              bunyan.debug({error: error}, 'No A records, error occured')

              var inst = new Instance(instance_address, type)
              inst.lookup(function(error) {
                if ( error ) {
                  --count
                  return
                }

                inst.ping(pong)
                self[type].push(inst)

                if ( self[type].length == count ) {
                  bunyan.debug('Everything resolved. Waiting for pong.')
                }
              })
              return
            }

            bunyan.debug('A records found')
            //TODO: exclude local address...
            count += addresses.length - 1

            for ( var x = 0 ; x < addresses.length ; x++ ) {
              bunyan.debug({local: local.get('address'), found: addresses[x]}, 'Comparing addresses.')
              if ( local.get('address') == addresses[x] ) {
                --count
                continue
              }
              var inst = new Instance(addresses[x] + (':'+instance_address.split(':')[1] || '').replace(/:$/, ''), type)
              inst.ping(pong)
              self[type].push(inst)
            }

            //bunyan.debug({self: self, type: type, selft: self[type], count: count, itype: (typeof itype)},'whoot.')
            if ( count == 0 ) {
              bunyan.debug('Only mongo instance. Going forward.')
              itype.emit ? itype.emit('_initialize') : itype()
            }
            else if ( self[type].length == count ) {
              bunyan.debug('Everything resolved. Waiting for pong.')
            }
            else {
              bunyan.debug({count: count, length: self[type].length}, 'Not finished yet.')
            }
          })
        })(instances[i])
      }
    }
    else bunyan.warn({instances: instances}, 'Maleformed mongo instance list.')
  })
}

module.exports = exports = new function() {
  var use = new common(),
      responses = []

  use.on('ping', function(instance, status) {
    bunyan.info({instance: instance.toString()}, 'Got ping.')

    instance.set(status)
    // send local instance status
    instance.emit('pong', local.toJSON())
  })

  use.on('pong', function (instance, status) {
    bunyan.info({instance: instance.toString()}, 'Got status.')

    instance.set(status)
  })


  return use
}
