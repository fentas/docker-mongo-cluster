#!/bin/bash
# @expects: {"members": ["<<mongod instance"], "initiate"}
#
#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
$(if echo $1 | jq -e '.initiate' > /dev/null; then
  echo "var i = rs.initiate()"
  echo "if ( ! i.ok ) { printjson(i); quit(); }"
fi)
$(for member in $(echo $1 | jq -r '.members[]'); do
  echo "var a = rs.add(\"$member\")"
  echo "if ( ! a.ok ) { printjson(a); quit(); }"
done)
rs.status()
EOF
