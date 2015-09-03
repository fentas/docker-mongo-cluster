#!/bin/bash

GIT=`which git`
if [ -z $GIT ]; then
  apt-get update && \
  apt-get install -y git
fi

rm -R /tmp/mongo
git clone https://github.com/fentas/mongo.git /tmp/mongo
rm -R /opt/*
cp -R /tmp/mongo/cluster/* /opt

forever stop all
forever start /opt/index.js
