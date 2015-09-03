#!/bin/bash
# @expects: {"members": ["<<mongod instance"], "initiate"}
#
#TODO: connection to local mongo (keyfile, password, etc..)
cat <<EOF | /usr/bin/mongo --quiet
if ( ! rs.conf() ) {
  printjson({"ok": 0, "errmsg": "replSet not configured"})
  quit()
}
$(for member in $(echo $1 | jq -r '.members[]'); do
  echo "var r = rs.remove(\"${member/:*/}\")"
  echo "if ( ! r.ok ) { printjson(r); quit(); }"
done)
rs.status()
EOF
