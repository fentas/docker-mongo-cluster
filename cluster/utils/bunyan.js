var bunyan = require('bunyan'),
    extend = require('extend'),
    prettystream = require('./prettystream')(),
    logger

prettystream.pipe(process.stdout)

module.exports = exports = function(options) {
  if ( logger ) {
    return logger
  }

  return logger = bunyan.createLogger(
    extend({
      name: 'syslog',
      streams: [
        {
          type: 'rotating-file',
          path: '/var/log/mongo-cluster/messages.log',
          period: '1d',
          count: 3
        },
        {
          stream: prettystream,
          type: 'raw',
          level: process.env['BUNYAN_STDOUT_LEVEL'] || 'info'
        }
      ]
    }, options)
  )
}
