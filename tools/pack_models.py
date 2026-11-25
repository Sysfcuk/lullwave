"""Pack downloaded glTF models into small self-contained .glb files for the app.

- Textures are shrunk and re-encoded as JPEG (colour 512 px, normal 256 px, roughness/metal 128 px).
- Geometry is quantised (KHR_mesh_quantization): positions as 16-bit integers with the scale and
  offset moved into a node, normals as 8-bit, texture coordinates as 16-bit, indices as 16-bit
  where they fit. That roughly halves the geometry, and three.js's GLTFLoader reads it natively.
- Everything goes into one .glb.

    python tools/pack_models.py assets-src/polyhaven web/models/penny Sofa_01 ArmChair_01 ...
"""
import io, json, os, struct, sys
from array import array
from PIL import Image

SIZES = {'base': 512, 'normal': 256, 'mr': 128}
FLOAT, BYTE, SHORT, USHORT, UINT = 5126, 5120, 5122, 5123, 5125
COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def roles(gltf):
    out = {}
    for m in gltf.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        for key, role in (('baseColorTexture', 'base'), ('metallicRoughnessTexture', 'mr')):
            if key in pbr: out[gltf['textures'][pbr[key]['index']]['source']] = role
        if 'normalTexture' in m: out[gltf['textures'][m['normalTexture']['index']]['source']] = 'normal'
    return out


def read(gl, blobs, ai):
    """An accessor's values as a flat list of floats/ints."""
    a = gl['accessors'][ai]; v = gl['bufferViews'][a['bufferView']]
    code, size = COMP[a['componentType']]; n = NCOMP[a['type']]
    stride = v.get('byteStride') or size * n
    base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    blob = blobs[v.get('buffer', 0)]
    out = []
    if stride == size * n:
        arr = array(code); arr.frombytes(blob[base: base + a['count'] * stride]); out = list(arr)
    else:
        for i in range(a['count']):
            out.extend(struct.unpack_from('<' + code * n, blob, base + i * stride))
    return out, n


class Writer:
    def __init__(self): self.body = bytearray(); self.views = []; self.accs = []
    def view(self, data, stride=None, target=None):
        while len(self.body) % 4: self.body.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.body), 'byteLength': len(data)}
        if stride: v['byteStride'] = stride
        if target: v['target'] = target
        self.body += data; self.views.append(v); return len(self.views) - 1
    def acc(self, a): self.accs.append(a); return len(self.accs) - 1


def pack(src_dir, name, out_path):
    gl = json.load(open(os.path.join(src_dir, name + '.gltf'), encoding='utf8'))
    blobs = [open(os.path.join(src_dir, b['uri']), 'rb').read() for b in gl['buffers']]
    W = Writer()
    mesh_xf = {}
    for mi, mesh in enumerate(gl.get('meshes', [])):
        # one uniform scale and offset per mesh, so normals stay true
        pos_all = []
        for pr in mesh['primitives']: pos_all.append(read(gl, blobs, pr['attributes']['POSITION'])[0])
        xs = [p[i] for p in pos_all for i in range(0, len(p), 3)]; ys = [p[i] for p in pos_all for i in range(1, len(p), 3)]; zs = [p[i] for p in pos_all for i in range(2, len(p), 3)]
        c = [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2]
        s = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) / 2 or 1
        mesh_xf[mi] = (c, s)
        for pr, P in zip(mesh['primitives'], pos_all):
            at = pr['attributes']; new = {}
            # positions: 16-bit normalised, padded to 8 bytes a vertex
            q = array('h'); qmin = [32767] * 3; qmax = [-32767] * 3
            for i in range(0, len(P), 3):
                for k in range(3):
                    v = max(-32767, min(32767, round((P[i + k] - c[k]) / s * 32767))); q.append(v)
                    qmin[k] = min(qmin[k], v); qmax[k] = max(qmax[k], v)
                q.append(0)
            new['POSITION'] = W.acc({'bufferView': W.view(q.tobytes(), 8, 34962), 'componentType': SHORT, 'normalized': True, 'count': len(P) // 3, 'type': 'VEC3', 'min': qmin, 'max': qmax})
            if 'NORMAL' in at:
                N, _ = read(gl, blobs, at['NORMAL']); qn = array('b')
                for i in range(0, len(N), 3):
                    for k in range(3): qn.append(max(-127, min(127, round(N[i + k] * 127))))
                    qn.append(0)
                new['NORMAL'] = W.acc({'bufferView': W.view(qn.tobytes(), 4, 34962), 'componentType': BYTE, 'normalized': True, 'count': len(N) // 3, 'type': 'VEC3'})
            for key in [k for k in at if k.startswith('TEXCOORD_')]:
                T, _ = read(gl, blobs, at[key])
                if T and min(T) >= 0 and max(T) <= 1:
                    qt = array('H', [round(t * 65535) for t in T])
                    new[key] = W.acc({'bufferView': W.view(qt.tobytes(), 4, 34962), 'componentType': USHORT, 'normalized': True, 'count': len(T) // 2, 'type': 'VEC2'})
                else:
                    new[key] = W.acc({'bufferView': W.view(array('f', T).tobytes(), 8, 34962), 'componentType': FLOAT, 'count': len(T) // 2, 'type': 'VEC2'})
            pr['attributes'] = new  # (tangents and anything else are dropped)
            if 'indices' in pr:
                I, _ = read(gl, blobs, pr['indices'])
                if max(I) < 65535: data, ct = array('H', I).tobytes(), USHORT
                else: data, ct = array('I', I).tobytes(), UINT
                pr['indices'] = W.acc({'bufferView': W.view(data, None, 34963), 'componentType': ct, 'count': len(I), 'type': 'SCALAR'})
    # each mesh moves onto a child node that undoes the quantisation
    for node in list(gl.get('nodes', [])):
        if 'mesh' in node:
            c, s = mesh_xf[node['mesh']]
            gl['nodes'].append({'mesh': node.pop('mesh'), 'translation': c, 'scale': [s, s, s]})
            node.setdefault('children', []).append(len(gl['nodes']) - 1)
    # shrink and embed images
    r = roles(gl)
    for i, img in enumerate(gl.get('images', [])):
        role = r.get(i, 'base')
        im = Image.open(os.path.join(src_dir, img['uri'])).convert('RGB')
        sz = SIZES[role]
        if max(im.size) > sz: im = im.resize((sz, round(sz * im.size[1] / im.size[0])), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84 if role == 'base' else 88, optimize=True)
        img.pop('uri', None); img['bufferView'] = W.view(buf.getvalue()); img['mimeType'] = 'image/jpeg'
    while len(W.body) % 4: W.body.append(0)
    gl['accessors'] = W.accs; gl['bufferViews'] = W.views; gl['buffers'] = [{'byteLength': len(W.body)}]
    for k in ('extensionsUsed', 'extensionsRequired'): gl[k] = sorted(set(gl.get(k, [])) | {'KHR_mesh_quantization'})
    js = json.dumps(gl, separators=(',', ':')).encode('utf8')
    while len(js) % 4: js += b' '
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(W.body))
    glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(W.body), 0x004E4942) + bytes(W.body)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    open(out_path, 'wb').write(glb)
    return len(glb)


if __name__ == '__main__':
    src, dst, *names = sys.argv[1:]
    total = 0
    for n in names:
        size = pack(os.path.join(src, n), n, os.path.join(dst, n + '.glb'))
        total += size
        print(f'{n:30s} {size / 1024:7.0f} KB')
    print(f'{"total":30s} {total / 1024:7.0f} KB')
