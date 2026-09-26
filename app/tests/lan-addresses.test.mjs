import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { lanIpv4 } = require('../../app-dist/main/lan/addresses.js');

assert.deepEqual(lanIpv4({
  Ethernet: [
    { family: 'IPv4', address: '192.168.1.20', internal: false },
    { family: 'IPv6', address: 'fe80::1', internal: false },
  ],
  Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  Wifi: [{ family: 'IPv4', address: '192.168.1.20', internal: false }],
}), ['192.168.1.20']);

console.log('app LAN address discovery tests passed');


