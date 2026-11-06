// FlashDrop Offline QR Code Generator
// Pure JavaScript, zero dependencies, client-side SVG renderer

class FlashDropQR {
  constructor() {
    this.GF = new Uint8Array(512);
    this.LOG = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.GF[i] = x;
      this.GF[i + 255] = x;
      this.LOG[x] = i;
      x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
  }

  gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return this.GF[this.LOG[a] + this.LOG[b]];
  }

  rsGenPoly(n) {
    let poly = [1];
    for (let i = 0; i < n; i++) {
      let next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= this.gfMul(poly[j], this.GF[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  rsEncode(data, numEc) {
    const poly = this.rsGenPoly(numEc);
    const result = new Uint8Array(numEc);
    for (let i = 0; i < data.length; i++) {
      const coef = data[i] ^ result[0];
      for (let j = 0; j < numEc - 1; j++) {
        result[j] = result[j + 1] ^ this.gfMul(coef, poly[poly.length - 2 - j]);
      }
      result[numEc - 1] = this.gfMul(coef, poly[0]);
    }
    return result;
  }

  static VERSIONS = [
    null,
    { ver: 1, size: 21, totalCw: 26, ecCw: 7, dataCw: 19, align: [] },
    { ver: 2, size: 25, totalCw: 44, ecCw: 10, dataCw: 34, align: [6, 18] },
    { ver: 3, size: 29, totalCw: 70, ecCw: 15, dataCw: 55, align: [6, 22] },
    { ver: 4, size: 33, totalCw: 100, ecCw: 20, dataCw: 80, align: [6, 26] },
    { ver: 5, size: 37, totalCw: 134, ecCw: 26, dataCw: 108, align: [6, 30] }
  ];

  generate(text) {
    const utf8 = new TextEncoder().encode(text);
    let vInfo = null;
    for (let v = 1; v <= 5; v++) {
      if (utf8.length + 2 <= FlashDropQR.VERSIONS[v].dataCw) {
        vInfo = FlashDropQR.VERSIONS[v];
        break;
      }
    }
    if (!vInfo) vInfo = FlashDropQR.VERSIONS[5];

    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    pushBits(4, 4); // Byte mode
    pushBits(utf8.length, 8);
    for (let b of utf8) pushBits(b, 8);
    const maxDataBits = vInfo.dataCw * 8;
    pushBits(0, Math.min(4, maxDataBits - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    const pad = [0xEC, 0x11];
    let padIdx = 0;
    while (bits.length < maxDataBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    const dataCw = new Uint8Array(vInfo.dataCw);
    for (let i = 0; i < vInfo.dataCw; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
      dataCw[i] = b;
    }

    const ec = this.rsEncode(dataCw, vInfo.ecCw);
    const finalCw = new Uint8Array(vInfo.totalCw);
    finalCw.set(dataCw, 0);
    finalCw.set(ec, dataCw.length);

    const N = vInfo.size;
    const matrix = Array.from({ length: N }, () => new Int8Array(N).fill(-1));
    const isReserved = Array.from({ length: N }, () => new Uint8Array(N));
    const setReserved = (r, c, val) => {
      matrix[r][c] = val;
      isReserved[r][c] = 1;
    };

    const addFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const nr = row + r, nc = col + c;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            setReserved(nr, nc, (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0);
          } else {
            setReserved(nr, nc, 0);
          }
        }
      }
    };
    addFinder(0, 0);
    addFinder(0, N - 7);
    addFinder(N - 7, 0);

    for (let i = 8; i < N - 8; i++) {
      setReserved(6, i, i % 2 === 0 ? 1 : 0);
      setReserved(i, 6, i % 2 === 0 ? 1 : 0);
    }

    if (vInfo.align.length > 0) {
      for (let ar of vInfo.align) {
        for (let ac of vInfo.align) {
          if (isReserved[ar][ac]) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              setReserved(ar + r, ac + c, (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0);
            }
          }
        }
      }
    }

    setReserved(4 * vInfo.ver + 9, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (!isReserved[8][i]) setReserved(8, i, 0);
      if (!isReserved[i][8]) setReserved(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) {
      if (!isReserved[8][N - 1 - i]) setReserved(8, N - 1 - i, 0);
      if (!isReserved[N - 1 - i][8]) setReserved(N - 1 - i, 8, 0);
    }

    const allBits = [];
    for (let b of finalCw) {
      for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
    }

    let bitIdx = 0;
    let up = true;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      const rows = up ? Array.from({ length: N }, (_, i) => N - 1 - i) : Array.from({ length: N }, (_, i) => i);
      for (let r of rows) {
        for (let dc = 0; dc < 2; dc++) {
          const col = c - dc;
          if (!isReserved[r][col]) {
            const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            const mask = (r + col) % 2 === 0 ? 1 : 0;
            matrix[r][col] = bit ^ mask;
          }
        }
      }
      up = !up;
    }

    const fmtBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
    for (let i = 0; i < 6; i++) matrix[8][i] = fmtBits[i];
    matrix[8][7] = fmtBits[6];
    matrix[8][8] = fmtBits[7];
    matrix[7][8] = fmtBits[8];
    for (let i = 0; i < 6; i++) matrix[5 - i][8] = fmtBits[9 + i];
    for (let i = 0; i < 7; i++) matrix[N - 1 - i][8] = fmtBits[i];
    for (let i = 0; i < 8; i++) matrix[8][N - 8 + i] = fmtBits[7 + i];

    return { size: N, matrix };
  }

  toSVG(text, margin = 2) {
    const { size, matrix } = this.generate(text);
    const totalSize = size + margin * 2;
    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          paths += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" rx="1.5"/>
      <path d="${paths}" fill="#0f172a"/>
    </svg>`;
  }
}

window.FlashDropQR = FlashDropQR;
