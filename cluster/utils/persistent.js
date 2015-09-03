var fs   = require('fs'),
    ini  = require('ini'),
    path = require('path');

function persistent(filename, defaultData) {
    var self = this;

    var data;

    try {
        data = ini.decode(fs.readFileSync(
            path.resolve(persistent.__dirname, filename), 'utf8'));
    } catch (err) {
        data = defaultData || {};
    }

    for (var k in data) {
        if (!(k in persistent.prototype)) {
            self[k] = data[k];
        }
    }

    self.__filename = filename;
}

module.exports = exports = persistent;

persistent.__dirname = '/etc/mongo-cluster'

if (!fs.existsSync(persistent.__dirname)) {
    throw new Error('Cannot find directory: ' + persistent.__dirname);
}

persistent.load = function(filename, defaultData) {
    return new persistent(filename, defaultData);
};

persistent.prototype.__filename = null;

persistent.prototype.save = function(filename) {
    var self = this;

    fs.writeFileSync(
        path.resolve(persistent.__dirname, filename || self.__filename),
        ini.encode(self.getAll()));
};

persistent.prototype.getAll = function() {
    var self = this;

    var ret = {};

    for (var k in self) {
        if (!(k in persistent.prototype)) {
            ret[k] = self[k];
        }
    }

    return ret;
};
