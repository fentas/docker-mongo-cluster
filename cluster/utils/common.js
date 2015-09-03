// https://raw.githubusercontent.com/arturadib/shelljs/master/src/common.js
//
var os = require('os');
var fs = require('fs');

// Module globals
var config = {
  silent: true,
  fatal: false
};
exports.config = config;

var state = {
  error: null,
  currentCmd: 'shell.js',
  tempDir: null
};
exports.state = state;

var platform = os.type().match(/^Win/) ? 'win' : 'unix';
exports.platform = platform;

function log() {
  if (!config.silent)
    console.log.apply(this, arguments);
}
exports.log = log;

// Shows error message. Throws unless _continue or config.fatal are true
function error(msg, _continue) {
  if (state.error === null)
    state.error = '';
  state.error += state.currentCmd + ': ' + msg + '\n';

  if (msg.length > 0)
    log(state.error);

  if (config.fatal)
    process.exit(1);

  if (!_continue)
    throw '';
}
exports.error = error;

// Returns {'alice': true, 'bob': false} when passed a dictionary, e.g.:
//   parseOptions('-a', {'a':'alice', 'b':'bob'});
function parseOptions(str, map) {
  if (!map)
    error('parseOptions() internal error: no map given');

  // All options are false by default
  var options = {};
  for (var letter in map)
    options[map[letter]] = false;

  if (!str)
    return options; // defaults

  if (typeof str !== 'string')
    error('parseOptions() internal error: wrong str');

  // e.g. match[1] = 'Rf' for str = '-Rf'
  var match = str.match(/^\-(.+)/);
  if (!match)
    return options;

  // e.g. chars = ['R', 'f']
  var chars = match[1].split('');

  chars.forEach(function(c) {
    if (c in map)
      options[map[c]] = true;
    else
      error('option not recognized: '+c);
  });

  return options;
}
exports.parseOptions = parseOptions;

// Normalizes _unlinkSync() across platforms to match Unix behavior, i.e.
// file can be unlinked even if it's read-only, see https://github.com/joyent/node/issues/3006
function unlinkSync(file) {
  try {
    fs.unlinkSync(file);
  } catch(e) {
    // Try to override file permission
    if (e.code === 'EPERM') {
      fs.chmodSync(file, '0666');
      fs.unlinkSync(file);
    } else {
      throw e;
    }
  }
}
exports.unlinkSync = unlinkSync;

// e.g. 'shelljs_a5f185d0443ca...'
function randomFileName() {
  function randomHash(count) {
    if (count === 1)
      return parseInt(16*Math.random(), 10).toString(16);
    else {
      var hash = '';
      for (var i=0; i<count; i++)
        hash += randomHash(1);
      return hash;
    }
  }

  return 'shelljs_'+randomHash(20);
}
exports.randomFileName = randomFileName;

// extend(target_obj, source_obj1 [, source_obj2 ...])
// Shallow extend, e.g.:
//    extend({A:1}, {b:2}, {c:3}) returns {A:1, b:2, c:3}
function extend(target) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function(source) {
    for (var key in source)
      target[key] = source[key];
  });

  return target;
}
exports.extend = extend;
