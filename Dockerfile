FROM ubuntu:24.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config python3 \
    libevent-dev libboost-dev libsqlite3-dev \
    libminiupnpc-dev libnatpmp-dev libzmq3-dev \
    libssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY . .

RUN cmake -B out \
    -DBUILD_DAEMON=ON \
    -DBUILD_GUI=OFF \
    -DBUILD_CLI=ON \
    -DBUILD_TESTS=OFF \
    -DWITH_ZMQ=ON \
    -DCMAKE_BUILD_TYPE=Release \
  && cmake --build out -j$(nproc) \
  && cmake --install out --prefix /install

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libevent-2.1-7t64 libevent-extra-2.1-7t64 libevent-pthreads-2.1-7t64 \
    libsqlite3-0 libminiupnpc17 libnatpmp1 libzmq5 \
    libssl3t64 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -r prometheus && useradd -r -g prometheus -m prometheus

COPY --from=builder /install/bin/ /usr/local/bin/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /home/prometheus

# P2P, RPC (metrics at /metrics on RPC port)
EXPOSE 8333 8332

VOLUME ["/home/prometheus/.prometheus"]

ENTRYPOINT ["entrypoint.sh"]
CMD ["-printtoconsole", "-rpcallowip=0.0.0.0/0", "-rpcbind=0.0.0.0"]
