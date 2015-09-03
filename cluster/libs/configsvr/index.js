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

  })

  return use
}
