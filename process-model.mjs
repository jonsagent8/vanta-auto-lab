// One-off: turn the Sketchfab M240i (single vertex-colored mesh) into a car-frame, part-split, compressed GLB.
// Car frame: x = length (front +), y = up (ground 0), z = width; meters, scaled to the 4.54 m spec length.
import fs from 'node:fs';
import { NodeIO, Document } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const src = await io.read('models/m240i-src.glb');
const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), C = prim.getAttribute('COLOR_0'), I = prim.getIndices().getArray();
const N = P.length / 3;
let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
for (let i = 0; i < N; i++) { ymin = Math.min(ymin, P[i * 3 + 1]); ymax = Math.max(ymax, P[i * 3 + 1]); xmin = Math.min(xmin, P[i * 3]); xmax = Math.max(xmax, P[i * 3]); }
const s = 4.54 / (ymax - ymin), xc = (xmin + xmax) / 2;
const pos = new Float32Array(N * 3), col = new Uint8Array(N);
const KEY = { '75,32,76': 1, '33,33,33': 2, '188,188,188': 3, '136,0,21': 4, '128,128,128': 5 };
const tmp = [];
for (let i = 0; i < N; i++) {
  const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
  pos[i * 3] = 2.27 - (y - ymin) * s; pos[i * 3 + 1] = z * s; pos[i * 3 + 2] = -(x - xc) * s;
  C.getElement(i, tmp); col[i] = KEY[tmp.slice(0, 3).map(v => Math.round(v * 255)).join(',')] || 0;
}
let zmin = Infinity; for (let i = 0; i < N; i++) zmin = Math.min(zmin, pos[i * 3 + 1]); for (let i = 0; i < N; i++) pos[i * 3 + 1] -= zmin;
// smooth normals over the whole mesh
const nrm = new Float32Array(N * 3);
for (let t = 0; t < I.length; t += 3) {
  const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
}
for (let i = 0; i < N; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
// wheel centres from the lowest dark (tyre) vertices
const lows = { f: [], r: [] };
for (let i = 0; i < N; i++) if (col[i] === 2 && pos[i * 3 + 1] < .03) (pos[i * 3] > 0 ? lows.f : lows.r).push(pos[i * 3]);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const WX = [mean(lows.r), mean(lows.f)], WR = .345;
console.log('scale', s.toFixed(4), 'wheel x', WX.map(v => v.toFixed(3)), 'wheelbase', (WX[1] - WX[0]).toFixed(3));
const nearWheel = (x, y, z) => Math.abs(z) > .5 && WX.some(wx => Math.hypot(x - wx, y - WR) < WR + .03);
const wheelR = (x, y) => Math.min(...WX.map(wx => Math.hypot(x - wx, y - WR)));
const isMirror = (x, y, z) => Math.abs(z) > .9 && y > .85 && y < 1.2 && x > -.1 && x < 1.1;
// classify triangles
const parts = {}, put = (name, t) => (parts[name] ||= []).push(I[t], I[t + 1], I[t + 2]);
for (let t = 0; t < I.length; t += 3) {
  const a = I[t], b = I[t + 1], c = I[t + 2];
  const k = [col[a], col[b], col[c]].sort()[1];
  const x = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, y = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, z = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
  if (k === 1) put(isMirror(x, y, z) ? 'trim' : 'paint', t);
  else if (k === 4) put('taillight', t);
  else if (k === 5) put('trim', t);
  else if (k === 2) put(nearWheel(x, y, z) ? 'tire' : (y > .97 && x > -1.85 && x < 1.3 && Math.abs(z) < .8 && !(x < -1.55 && y < 1.06)) ? 'glass' : 'trim', t);
  else if (k === 3) put(nearWheel(x, y, z) ? (wheelR(x, y) > .262 ? 'tire' : 'rim') : (x > 1.7 && y > .5 && y < .85 && Math.abs(z) > .35) ? 'headlight' : 'chrome', t);
  else put('trim', t);
}
for (const [n, a] of Object.entries(parts)) console.log(n.padEnd(10), (a.length / 3) | 0, 'tris');
// write: one mesh per part, compacted vertices
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('car'), root = doc.createNode('m240i'); scene.addChild(root);
for (const [name, idx] of Object.entries(parts)) {
  const remap = new Map(), vp = [], vn = [], ni = new Uint32Array(idx.length);
  idx.forEach((v, j) => { let r = remap.get(v); if (r === undefined) { r = remap.size; remap.set(v, r); vp.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); vn.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); } ni[j] = r; });
  const p = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(vp)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(vn)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(ni).setBuffer(buf))
    .setMaterial(doc.createMaterial(name));
  root.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)));
}
await MeshoptEncoder.ready;
await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write('models/m240i.glb', doc);
console.log('wrote', (fs.statSync('models/m240i.glb').size / 1e6).toFixed(2), 'MB');
