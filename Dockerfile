FROM mongo:3.0
MAINTAINER Jan Guth <jan.guth@gmail.com>

ENV MONGO_CLUSTER_ENABLED=1

ENV MONGO_CLUSTER_CONFIGSVR=""
ENV MONGO_CLUSTER_MONGOD=""
ENV MONGO_CLUSTER_MONGOS=""

ENV MONGO_CLUSTER_CNAME=""
ENV MONGO_CLUSTER_ADDRESS=""

ENV MONGO_CLUSTER_TIMEOUT=5000
ENV MONGO_CLUSTER_RETRIES=3

ENV BUNYAN_STDOUT_LEVEL='info'

# grap jq for json parsing
RUN curl -o /usr/local/bin/jq -SL 'https://github.com/stedolan/jq/releases/download/jq-1.5/jq-linux64' && \
  chmod +x /usr/local/bin/jq

# nodejs source
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo 'deb https://deb.nodesource.com/node_0.12 wheezy main' > /etc/apt/sources.list.d/nodesource.list

RUN set -x && \
  apt-get update && \
  apt-get install -y \
    nodejs \
    libcurl3-dev \
  && rm -rf /var/lib/apt/lists/*

RUN \
  npm install -g forever && \
  npm install -g bunyan

RUN \
  mkdir -p /var/log/mongo-cluster && chown -R mongodb:mongodb /var/log/mongo-cluster && \
  mkdir -p /data/db && chown -R mongodb:mongodb /data/db && \
  mkdir -p /data/configdb && chown -R mongodb:mongodb /data/configdb
VOLUME /data/db
VOLUME /data/configdb

COPY ./cluster /opt
COPY docker-entrypoint.sh /entrypoint.sh
RUN \
  cd /opt && npm install && \
  touch /run/mongodb.pid && \
  chown mongodb:mongodb /run/mongodb.pid

ENTRYPOINT ["/entrypoint.sh"]

# udp port
EXPOSE 27023

# default mongod server port
EXPOSE 27017
# default mongod shard port
EXPOSE 27018
# default mongod --configsvr port
EXPOSE 27019
# http monitoring
EXPOSE 28017
EXPOSE 28018
EXPOSE 28019
CMD ["mongod"]
