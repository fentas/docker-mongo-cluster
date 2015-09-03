var middleware = require('../../utils/middleware'),
    shell = require('../../utils/shell'),
    common = require('../common'),
    util = require('util'),
    local = require('../local'),
    bunyan = require('../../utils/bunyan')()

shell.defaultOptions = {
  scriptPath: __dirname,
  mode: 'json'
}

util.inherits(mongos, middleware)
function mongos() {

}

module.exports = exports = new function() {
  var use = new mongos()

    // first run
    common.on('_initialize', function() {
      //TODO: look out for shards. compare what is registered and what isn't.
    })

    use.on('sh.addShard', function(instance) {
      var shard = instance.getFullAddress()
      if ( instance.get('_.rs.conf') )
        shard = instance.get('_.rs.conf')._id + '/' + shard

      shell.run('_.sh.addShard.sh', {
        "args": {
          "shard": shard
        }
      }, function(err, result) {
        if ( err ) bunyan.error({error: err}, '_.sh.addShard.sh failed.')

        //TODO: send feedback? what to do on error?
        //local.set('_.rs.status', result[0])
      })
    })

  return use
}
