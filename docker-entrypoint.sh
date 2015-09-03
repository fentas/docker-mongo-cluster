#!/bin/bash
set -e

if [ "${1:0:1}" = '-' ]; then
	set -- mongod "$@"
fi

if [ "$1" = 'mongod' ] || [ "$1" = 'mongos' ]; then
	chown -R mongodb /data/db /data/configdb

	if [ ! -z $MONGO_CLUSTER_ENABLED ]; then
		function watchCluster() {
			sleep 10
			exec /usr/bin/nodejs /opt/index.js "$@"
		}
		watchCluster "$@" &
	fi

	numa='numactl --interleave=all'
	if $numa true &> /dev/null; then
		set -- $numa "$@"
	fi

	exec gosu mongodb "$@" --pidfilepath /run/mongodb.pid
fi

exec "$@"
