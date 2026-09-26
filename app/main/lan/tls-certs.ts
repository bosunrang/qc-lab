import { createHash, createPublicKey, generateKeyPairSync, randomBytes, sign, X509Certificate, type KeyObject } from 'node:crypto';
import { isIPv4 } from 'node:net';

/**
 * Chứng chỉ HTTPS cho máy chủ LAN, do chính app cấp.
 *
 * Máy chính giữ một CA riêng (khoá bí mật không rời máy). Máy nhân viên cài
 * chứng chỉ gốc của CA này MỘT lần; chứng chỉ máy chủ được cấp lại tự động mỗi
 * khi app mở hoặc địa chỉ IP đổi, nên máy nhân viên không phải cài lại.
 *
 * Node không có API dựng chứng chỉ X.509, nên tệp này tự mã hoá DER cho đúng
 * các trường cần dùng. Test kiểm lại bằng `X509Certificate` và bắt tay TLS
 * thật: `tests/lan-tls.test.mjs`.
 */

// ---- Mã hoá DER tối thiểu -------------------------------------------------

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function tlv(tag: number, content: Buffer): Buffer { return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]); }
const seq = (...parts: Buffer[]) => tlv(0x30, Buffer.concat(parts));
const set = (...parts: Buffer[]) => tlv(0x31, Buffer.concat(parts));
const octets = (content: Buffer) => tlv(0x04, content);
const utf8 = (text: string) => tlv(0x0c, Buffer.from(text, 'utf8'));
const bool = (value: boolean) => tlv(0x01, Buffer.from([value ? 0xff : 0x00]));
/** `[n] EXPLICIT` — bọc nguyên một phần tử đã mã hoá. */
const explicit = (n: number, inner: Buffer) => tlv(0xa0 | n, inner);
/** BIT STRING với số bit thừa ở byte cuối (mặc định 0). */
const bits = (content: Buffer, unused = 0) => tlv(0x03, Buffer.concat([Buffer.from([unused]), content]));

/** INTEGER không âm: bỏ số 0 thừa ở đầu, thêm 0x00 nếu bit cao nhất bật. */
function uint(content: Buffer): Buffer {
  let start = 0;
  while (start < content.length - 1 && content[start] === 0) start++;
  const trimmed = content.subarray(start);
  return tlv(0x02, trimmed[0] & 0x80 ? Buffer.concat([Buffer.from([0]), trimmed]) : trimmed);
}

function oid(dotted: string): Buffer {
  const arcs = dotted.split('.').map(Number);
  const bytes = [40 * arcs[0] + arcs[1]];
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f];
    for (let rest = Math.floor(arc / 128); rest > 0; rest = Math.floor(rest / 128)) chunk.unshift(0x80 | (rest & 0x7f));
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
}

/** RFC 5280: UTCTime trước năm 2050, GeneralizedTime từ năm 2050. */
function time(date: Date): Buffer {
  const iso = date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
  return date.getUTCFullYear() < 2050 ? tlv(0x17, Buffer.from(iso.slice(2), 'ascii')) : tlv(0x18, Buffer.from(iso, 'ascii'));
}

const OID = {
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  commonName: '2.5.4.3',
  organization: '2.5.4.10',
  subjectKeyId: '2.5.29.14',
  keyUsage: '2.5.29.15',
  subjectAltName: '2.5.29.17',
  basicConstraints: '2.5.29.19',
  nameConstraints: '2.5.29.30',
  authorityKeyId: '2.5.29.35',
  extKeyUsage: '2.5.29.37',
  serverAuth: '1.3.6.1.5.5.7.3.1',
};

const extension = (id: string, critical: boolean, value: Buffer) => seq(oid(id), ...(critical ? [bool(true)] : []), octets(value));
const name = (commonName: string) => seq(set(seq(oid(OID.commonName), utf8(commonName))), set(seq(oid(OID.organization), utf8('QC Lab'))));
const ipBytes = (ip: string) => Buffer.from(ip.split('.').map(Number));

// ---- Giới hạn của CA -------------------------------------------------------

/**
 * Dải địa chỉ CA được phép cấp chứng chỉ (Name Constraints, RFC 5280).
 * Cài chứng chỉ gốc lên máy nhân viên nghĩa là máy đó tin mọi chứng chỉ CA ký;
 * giới hạn này để khoá CA, nếu lộ, cũng không giả được trang Internet nào: chỉ
 * địa chỉ IPv4 nội bộ, và chỉ một tên miền không bao giờ tồn tại (`.invalid`,
 * RFC 2606) — tức không tên miền thật nào hợp lệ.
 */
export const CA_PERMITTED_IPV4: ReadonlyArray<{ network: string; prefix: number }> = [
  { network: '10.0.0.0', prefix: 8 },
  { network: '172.16.0.0', prefix: 12 },
  { network: '192.168.0.0', prefix: 16 },
  { network: '100.64.0.0', prefix: 10 },
  { network: '169.254.0.0', prefix: 16 },
  { network: '127.0.0.0', prefix: 8 },
];
const CA_PERMITTED_DNS = 'qclab.invalid';

function ipToInt(ip: string): number { return ip.split('.').reduce((acc, part) => (acc * 256) + Number(part), 0); }
function prefixMask(prefix: number): number { return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0; }

/** Địa chỉ nằm trong dải CA được phép, tức trình duyệt chấp nhận chứng chỉ. */
export function caCoversIp(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  const value = ipToInt(ip);
  return CA_PERMITTED_IPV4.some(({ network, prefix }) => ((value & prefixMask(prefix)) >>> 0) === ipToInt(network));
}

/** Các IPv4 trong dải CA được phép, không trùng, đã sắp xếp. */
export function coveredIps(ips: readonly string[]): string[] {
  return [...new Set(ips.filter(caCoversIp))].sort();
}

function nameConstraints(): Buffer {
  const subtrees = [
    // GeneralSubtree { base GeneralName }; iPAddress [7] = địa chỉ + mặt nạ.
    ...CA_PERMITTED_IPV4.map(({ network, prefix }) => {
      const mask = prefixMask(prefix);
      return seq(tlv(0x87, Buffer.concat([ipBytes(network), Buffer.from([mask >>> 24, (mask >>> 16) & 0xff, (mask >>> 8) & 0xff, mask & 0xff])])));
    }),
    seq(tlv(0x82, Buffer.from(CA_PERMITTED_DNS, 'ascii'))),
  ];
  // Danh sách được phép: trường permittedSubtrees, thẻ [0] IMPLICIT.
  return seq(tlv(0xa0, Buffer.concat(subtrees)));
}

// ---- Dựng và ký chứng chỉ -----------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
/** CA dùng lâu: đổi CA đồng nghĩa mọi máy nhân viên phải cài lại. */
export const CA_VALIDITY_DAYS = 3650;
/** Dưới 398 ngày như trình duyệt đòi với chứng chỉ máy chủ. */
export const SERVER_VALIDITY_DAYS = 397;
/** Lùi ngày bắt đầu hiệu lực: đồng hồ máy nhân viên có thể chậm hơn máy chính. */
const BACKDATE_MS = 2 * DAY_MS;

export interface LanCa { certPem: string; certDer: Buffer; key: KeyObject; cert: X509Certificate; }
export interface ServerCredentials { cert: string; key: string; ips: string[]; notAfter: Date; }

function keyId(publicKey: KeyObject): Buffer { return createHash('sha1').update(publicKey.export({ type: 'spki', format: 'der' })).digest(); }
function serial(): Buffer { const bytes = randomBytes(16); bytes[0] = (bytes[0] & 0x7f) | 0x01; return bytes; }

function buildCertificate(input: {
  issuer: string; subject: string; notBefore: Date; notAfter: Date;
  publicKey: KeyObject; signingKey: KeyObject; extensions: Buffer[];
}): X509Certificate {
  const algorithm = seq(oid(OID.ecdsaWithSha256));
  const tbs = seq(
    explicit(0, uint(Buffer.from([2]))),
    uint(serial()),
    algorithm,
    name(input.issuer),
    seq(time(input.notBefore), time(input.notAfter)),
    name(input.subject),
    input.publicKey.export({ type: 'spki', format: 'der' }),
    explicit(3, seq(...input.extensions)),
  );
  // Khoá EC: `sign()` trả chữ ký DER (Ecdsa-Sig-Value) đúng như X.509 cần.
  const signature = sign('sha256', tbs, input.signingKey);
  return new X509Certificate(seq(tbs, algorithm, bits(signature)));
}

const CA_NAME = 'QC Lab LAN CA';

export function createLanCa(now = new Date()): LanCa {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const id = keyId(publicKey);
  const cert = buildCertificate({
    issuer: CA_NAME, subject: CA_NAME,
    notBefore: new Date(now.getTime() - BACKDATE_MS), notAfter: new Date(now.getTime() + CA_VALIDITY_DAYS * DAY_MS),
    publicKey, signingKey: privateKey,
    extensions: [
      extension(OID.basicConstraints, true, seq(bool(true), uint(Buffer.from([0])))),
      // keyCertSign (bit 5) + cRLSign (bit 6): 0b0000_0110, thừa 1 bit.
      extension(OID.keyUsage, true, bits(Buffer.from([0x06]), 1)),
      // Chỉ ký chứng chỉ máy chủ web; Windows và OpenSSL xét cả EKU của CA.
      extension(OID.extKeyUsage, false, seq(oid(OID.serverAuth))),
      extension(OID.nameConstraints, true, nameConstraints()),
      extension(OID.subjectKeyId, false, octets(id)),
    ],
  });
  return lanCaFrom(cert.toString(), privateKey);
}

/** Dựng lại CA từ tệp đã lưu; ném lỗi nếu khoá không khớp chứng chỉ. */
export function lanCaFrom(certPem: string, key: KeyObject): LanCa {
  const cert = new X509Certificate(certPem);
  if (!cert.ca || !cert.checkPrivateKey(key)) throw new Error('Chứng chỉ CA và khoá không khớp.');
  return { certPem: cert.toString(), certDer: cert.raw, key, cert };
}

/**
 * Cấp chứng chỉ máy chủ cho các địa chỉ IPv4 hiện có. Địa chỉ ngoài dải CA
 * được phép bị bỏ (trình duyệt sẽ từ chối), trừ khi gọi với `unchecked` — chỉ
 * test dùng để kiểm Name Constraints thật sự có hiệu lực.
 */
export function issueServerCredentials(ca: LanCa, ips: readonly string[], now = new Date(), options: { unchecked?: boolean; dnsNames?: string[] } = {}): ServerCredentials {
  const covered = options.unchecked ? [...new Set(ips.filter((ip) => isIPv4(ip)))].sort() : coveredIps(ips);
  if (!covered.length && !options.dnsNames?.length) throw new Error('Không có địa chỉ IPv4 nội bộ để cấp chứng chỉ.');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const notAfter = new Date(now.getTime() + SERVER_VALIDITY_DAYS * DAY_MS);
  const altNames = [
    ...covered.map((ip) => tlv(0x87, ipBytes(ip))),
    ...(options.dnsNames || []).map((dns) => tlv(0x82, Buffer.from(dns, 'ascii'))),
  ];
  const cert = buildCertificate({
    issuer: CA_NAME, subject: 'QC Lab LAN',
    notBefore: new Date(now.getTime() - BACKDATE_MS), notAfter,
    publicKey, signingKey: ca.key,
    extensions: [
      extension(OID.basicConstraints, true, seq()),
      // digitalSignature (bit 0): 0b1000_0000, thừa 7 bit.
      extension(OID.keyUsage, true, bits(Buffer.from([0x80]), 7)),
      extension(OID.extKeyUsage, false, seq(oid(OID.serverAuth))),
      extension(OID.subjectAltName, false, seq(...altNames)),
      extension(OID.subjectKeyId, false, octets(keyId(publicKey))),
      extension(OID.authorityKeyId, false, seq(tlv(0x80, keyId(createPublicKey(ca.key))))),
    ],
  });
  return { cert: cert.toString(), key: String(privateKey.export({ type: 'pkcs8', format: 'pem' })), ips: covered, notAfter };
}

/** Dấu vân tay SHA-1 theo cách Windows hiện ("Thumbprint"), chia nhóm 4 ký tự
 * để người quản trị so với hộp thoại cài chứng chỉ trên máy nhân viên. */
export function caThumbprint(ca: LanCa): string {
  return createHash('sha1').update(ca.certDer).digest('hex').match(/.{4}/g)!.join(' ');
}
