#!/bin/bash
# @expects: {"members": ["<<mongod instance"], "initiate"}
#
#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
$(if echo $1 | jq -e '.initiate' > /dev/null; then
  echo "var i = rs.initiate()"
  echo "if ( ! i.ok ) { printjson(i); quit(); }"
fi)
rs.reconfig($(echo $1 | jq -r '.configuration'), { force: $(echo $1 | jq -r '.force') })
EOF
