#!/bin/bash

#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
rs.status()
EOF
