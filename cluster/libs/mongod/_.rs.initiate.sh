#!/bin/bash
# @expects: {"members": ["<<mongod instance"], "initiate"}
#
#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
rs.initiate()
EOF
