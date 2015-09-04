var middleware = require('../../utils/middleware'),
    common = require('../common'),
    local = require('../local'),
    util = require('util'),
    shell = require('../../utils/shell'),
    bunyan = require('../../utils/bunyan')()

shell.defaultOptions = {
  scriptPath: __dirname,
  mode: 'ejson'
}

util.inherits(mongod, middleware)
function mongod() {

}

function getReplSetPeers() {
  bunyan.debug({peers: common.getInstances('mongod'), type: (typeof common.getInstances('mongod'))}, 'getReplSetPeers')
  return rs = common.getInstances('mongod').filter(function(instance, i) {
    //TODO: what if config file is used.
    bunyan.debug({local: local.get('_.argv').replSet, instance: instance.get('_.argv').replSet}, 'Compare peers')
    if ( instance.get('_.argv').replSet == local.get('_.argv').replSet )
      return true
  })
}

function replSetStartup(initiate) {
  var primary = null,
      setup = true,
      rs = getReplSetPeers()

  bunyan.debug({rs: rs}, 'Checkout peers.')
  for ( var i = 0 ; i < rs.length ; i++ ) {
    if ( setup ) setup = local.get('started') < rs[i].get('started')

    if ( rs[i].get('_.rs.isMaster').ismaster ) {
      primary = rs[i]
      break
    }
  }

  if ( primary ) {
    bunyan.debug({primary: primary}, 'Got primary.')
    primary.emit('rs.add')
  }
  else if ( setup ) {
    bunyan.debug('I am prime! Setup.')
    if ( rs.length != 2 ) bunyan.warn('There should be 3 instances in %s. Given: %s.', local.get('replSet'), rs.length+1)
    var configuration = {
          "_id": local.get('_.argv').replSet,
          "members": [],
        }
    configuration.members.push({"_id": 0, "host": local.getFullAddress()})
    for ( var i = 1 ; i <= rs.length ; i++ )
      configuration.members.push({"_id": i, "host": rs[i].getFullAddress()})

    shell.run('_.rs.reconfig.sh', {
      "args": {
        "initiate": (typeof initiate === 'boolean' ? initiate : true),
        "force": true,
        "configuration": configuration
      }
    }, function(err, result) {
      if ( err ) bunyan.fatal({error: err}, '_.rs.reconfig.sh failed.')
      else if ( ! result[0] || ! result[0].ok )
        bunyan.warn({result: result}, '[reconf] something went wrong.')
      else
        bunyan.info({result: result}, '[reconf] ReplSet is setup.')
    })

    // if shard there is a mongos, then register to mongos
    // TODO: what if mongos is not started yet?
    bunyan.debug('Check for mongos. Shard replSet?')
    var mongos = common.getInstances('mongos')[0]
    if ( mongos ) mongos.emit('sh.addShard')
  }
}

module.exports = exports = new function() {
  var use = new mongod()

  use.on('rs.add', function(instance) {
    var self = this

    if ( local.get('_.db.isMaster').ismaster ) {
      shell.run('_.rs.add.sh', {
        "args": {
          "members": [instance.getFullAddress()]
        }
      }, function(err, result) {
        if ( err ) instance.emit('error', {'errmsg': 'rs.add error', 'data': err})
      })
      // make sure members are clean and all there
      common.lookupMongoCluster(function() {
        var rs = common.getInstances('mongod').filter(function(instance) {
          //TODO: what if config file is used.
          if ( instance.get('_.argv').replSet == local.get('_.argv').replSet )
            return true
        })
        self.get('_.rs.conf').members.forEach(function(member) {
          var is = rs.filter(function(instance) {
            if ( instance.getFullAddress() == member.host )
              return true
          })
          // host is not there anymore
          if ( ! is.length ) {
            use.emit('rs.remove', member.host)
          }
        })
      })
    }
    else instance.emit('error', {'errmsg': 'i am not prime.'})
  })

  use.on('rs.remove', function(instance) {
    if ( local.get('_.db.isMaster').ismaster ) {
      var member = ( typeof instance == 'string' ? instance : instance.getFullAddress() )
      shell.run('_.rs.remove.sh', {
        "args": {
          "members": [member]
        }
      }, function(err, result) {
        if ( err || ! result[0].ok ) bunyan.error({error: err, result: result[0]}, '_.rs.remove.sh failed.') //instance.emit('error', {'errmsg': 'rs.remove error', 'data': err})
      })
    }
    //else if ( typeof instance != 'string' ) instance.emit('error', {'errmsg': 'i am not prime.'})
  })

  // first run
  use.on('_initialize', function initialize() {
    //TODO: on reboot nothing to do
    if ( local.status == 'configured' ) return;

    // replSet is in startup.
    var rs_status = local.get('_.rs.status')
    if ( ! rs_status.ok ) {
      //bunyan.info({status: rs_status}, 'Unknown replSet status.')
      bunyan.info({status: rs_status}, 'check code.')
      // "errmsg" : "no replset config has been received"
      // "info" : "run rs.initiate(...) if not yet done for the set"
      if ( rs_status.code == 94 )
        replSetStartup(true)
      // "errmsg" : "Our replica set config is invalid or we are not a member of it"
      else if ( rs_status.code == 93 )
        replSetStartup(false)
    }
    else if ( rs_status.startupStatus ) {
      switch ( rs_status.startupStatus ) {
        // errmsg:  loading local.system.replset config (LOADINGCONFIG)
        // url[]:   http://ufasoli.blogspot.de/2013/05/reconfiguring-mongodb-replicaset-after.html
        case 1:
          if ( local.get('_.rs.conf') ) {
            bunyan.error('Stuck on rs startup.')
          }
          //TODO: death loop?
          else setTimeout(function() { (initialize || arguments.callee)() }, 1000)
          break;
        // errmsg:  can't get local.system.replset config from self or any seed (EMPTYCONFIG)
        // info:    run rs.initiate(...) if not yet done for the set
        case 3:
          replSetStartup()
          break;
        // errmsg:  all members and seeds must be reachable to initiate set
        // url[]:   http://www.devthought.com/2012/09/18/fixing-mongodb-all-members-and-seeds-must-be-reachable-to-initiate-set/
        case 4:
          //TODO: reconfig members of prime
          bunyan.error({status: local.get('_.rs.status')}, 'all members and seeds must be reachable to initiate set')
          break;
        default:
          bunyan.error({status: local.get('_.rs.status')}, 'Unknown startupStatus.')
      }
    }
  })

  return use
}
