FROM ubuntu:24.04@sha256:d1e2e92c075e5ca139d51a140fff46f84315c0fdce203eab2807c7e495eff4f9 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config python3 \
    libevent-dev libboost-dev libsqlite3-dev \
    libzmq3-dev \
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

FROM ubuntu:24.04@sha256:d1e2e92c075e5ca139d51a140fff46f84315c0fdce203eab2807c7e495eff4f9

RUN apt-get update && apt-get install -y --no-install-recommends \
    libevent-2.1-7t64 libevent-extra-2.1-7t64 libevent-pthreads-2.1-7t64 \
    libsqlite3-0 libzmq5 \
    libssl3t64 ca-certificates python3 curl gpg \
  && rm -rf /var/lib/apt/lists/*

# Tor from the Tor Project repository (Ubuntu's 0.4.8 is too old for the current network)
RUN curl -fsSL https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc \
    | gpg --dearmor -o /usr/share/keyrings/deb.torproject.org-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/deb.torproject.org-keyring.gpg] https://deb.torproject.org/torproject.org noble main" \
    > /etc/apt/sources.list.d/tor.list \
  && apt-get update && apt-get install -y --no-install-recommends tor deb.torproject.org-keyring \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -r bitcoin && useradd -r -g bitcoin -m bitcoin

COPY --from=builder /install/bin/ /usr/local/bin/
COPY scripts/rpcauth.py /usr/local/bin/rpcauth.py
RUN chmod +x /usr/local/bin/rpcauth.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /home/bitcoin

# P2P, RPC (metrics at /metrics on RPC port)
EXPOSE 8333 8332

VOLUME ["/home/bitcoin/.bitcoin"]

ENTRYPOINT ["entrypoint.sh"]
CMD ["-printtoconsole"]
