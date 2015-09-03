#!/bin/bash
# @expects: {"shard": "<<mongod instance>>"}
#
#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
sh.addShard(\"$(echo $1 | jq -r '.shard')\")
EOF
