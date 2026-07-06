import http from 'node:http';
import net from 'node:net';

const listenHost = process.env.KM_PROXY_HOST ?? '127.0.0.1';
const listenPort = Number(process.env.KM_PROXY_PORT ?? 3220);
const clientTarget = new URL(process.env.KM_CLIENT_TARGET ?? 'http://127.0.0.1:3210');
const serverTarget = new URL(process.env.KM_SERVER_TARGET ?? 'http://127.0.0.1:3211');

function routeFor(url = '/') {
  if (url.startsWith('/km/socket.io')) {
    return { target: serverTarget, path: url.replace(/^\/km\/socket\.io/, '/socket.io') };
  }
  if (url === '/km' || url.startsWith('/km?')) {
    return { target: clientTarget, path: url.replace(/^\/km(?=\?|$)/, '/km/') };
  }
  if (url.startsWith('/km/')) {
    return { target: clientTarget, path: url };
  }
  return null;
}

function proxyHeaders(headers, target) {
  return {
    ...headers,
    host: target.host,
  };
}

const proxy = http.createServer((req, res) => {
  const route = routeFor(req.url);
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const upstream = http.request(
    {
      protocol: route.target.protocol,
      hostname: route.target.hostname,
      port: route.target.port,
      method: req.method,
      path: route.path,
      headers: proxyHeaders(req.headers, route.target),
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Bad gateway: ${error.message}`);
  });

  req.pipe(upstream);
});

proxy.on('upgrade', (req, socket, head) => {
  const route = routeFor(req.url);
  if (!route) {
    socket.destroy();
    return;
  }

  const upstream = net.connect(Number(route.target.port), route.target.hostname, () => {
    upstream.write(
      `${req.method} ${route.path} HTTP/${req.httpVersion}\r\n` +
        Object.entries(proxyHeaders(req.headers, route.target))
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value ?? ''}`)
          .join('\r\n') +
        '\r\n\r\n',
    );
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', () => socket.destroy());
});

proxy.listen(listenPort, listenHost, () => {
  console.log(`[km-proxy] http://${listenHost}:${listenPort}/km -> client ${clientTarget.href}, socket ${serverTarget.href}`);
});
