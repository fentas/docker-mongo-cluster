var argv = require('minimist')(process.argv.slice(2)),
    udp = require('./utils/udp'),
    common = require('./libs/common'),
    local = require('./libs/local'),
    itype = require('./libs/' + local.get('type'))

// set up bunyan
require('./utils/bunyan')({

})

// set up udp

udp
  .use(common)
  .use(itype)
  .bind(27023)

// intuducing myself
common.lookupMongoCluster(itype)
