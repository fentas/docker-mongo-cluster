var middleware = require('../../utils/middleware'),
    common = require('../common'),
    local = require('../local'),
    util = require('util'),
    shell = require('../../utils/shell'),
    bunyan = require('../../utils/bunyan')()

shell.defaultOptions = {
  scriptPath: __dirname,
  mode: 'json'
}

util.inherits(mongod, middleware)
function mongod() {

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
  common.on('_initialize', function initialize() {
    //TODO: on reboot nothing to do
    if ( local.status == 'configured' ) return;

    // replSet is in startup.
    var rs_status = local.get('_.rs.status')
    if ( ! rs_status.ok ) {
      bunyan.info({status: rs_status}, 'Instance is single mongod instance; no replSet.')
    }
    else if ( rs_status.startupStatus ) {
      var rs = common.getInstances('mongod').filter(function(instance, i) {
        //TODO: what if config file is used.
        if ( instance.get('_.argv').replSet == local.get('_.argv').replSet )
          return true
      })

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
          var primary = null,
              setup = true

          for ( var i = 0 ; i < rs.length ; i++ ) {
            if ( setup ) setup = local.get('started') < rs[i].get('started')

            if ( rs[i].get('_.rs.isMaster').ismaster ) {
              primary = rs[i]
              break
            }
          }

          if ( primary ) {
            primary.emit('rs.add')
          }
          else if ( setup ) {
            if ( rs.length != 2 ) bunyan.warn('There should be 3 instances in %s. Given: %s.', local.get('replSet'), rs.length+1)
            var members = []
            members.push(local.getFullAddress())
            for ( var i = 0 ; i < rs.length ; i++ )
              members.push(rs[i].getFullAddress())

            shell.run('_.rs.add.sh', {
              "args": {
                "initiate": true,
                "members": members
              }
            }, function(err, result) {
              if ( err ) bunyan.fatal({error: err}, '_.rs.add.sh failed.')

              local.set('_.rs.status', result[0])
            })

            // if shard there is a mongos, then register to mongos
            // TODO: what if mongos is not started yet?
            var mongos = common.getInstances('mongos')[0]
            if ( mongos ) mongos.emit('sh.addShard')
          }

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
