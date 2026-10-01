import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { paths } from '../config/env';

/** werkzeug.utils.secure_filename */
export function secureFilename(filename: string): string {
  let f = filename.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  f = f.replace(/[\\/]/g, ' ');
  f = f.split(/\s+/).filter(Boolean).join('_');
  f = f.replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[._]+|[._]+$/g, '');
  if (process.platform === 'win32' && /^(CON|AUX|NUL|PRN|COM[1-9]|LPT[1-9])$/i.test(f.split('.')[0])) f = '_' + f;
  return f;
}

export const ALLOWED_EXTS = new Set(['pdf', 'dwg', 'dxf', 'xlsx', 'xls', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'zip', 'rar', 'txt']);

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function extOf(name: string): string {
  return name.includes('.') ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : '';
}

ensureDir(paths.TMP_UPLOAD_DIR);

/** Uploads are streamed to a temp dir (files can be very large - DWG, ZIP...). */
export const upload = multer({ dest: paths.TMP_UPLOAD_DIR });

/** Files uploaded under a field name (multer.any()) */
export function filesOf(req: Request, name: string): Express.Multer.File[] {
  const files = (req.files as Express.Multer.File[]) || [];
  return files.filter((f) => f.fieldname === name || f.fieldname === name + '[]');
}

export function firstFile(req: Request, name: string): Express.Multer.File | undefined {
  return filesOf(req, name)[0];
}

/** Remove any temp files multer left behind once the response is finished. */
export function cleanupTempFiles(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const files = (req.files as Express.Multer.File[]) || [];
    for (const f of files) {
      if (f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch {}
      }
    }
  });
  next();
}

/** Move a temp upload to its final location (rename, falling back to copy across drives / network shares). */
export function moveFile(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
    try {
      fs.unlinkSync(src);
    } catch {}
  }
}

/** struct-based image size sniffing (PNG/JPEG) - port of img_dims() */
export function imgDims(p: string): [number, number] {
  try {
    const data = fs.readFileSync(p);
    if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return [data.readUInt32BE(16), data.readUInt32BE(20)];
    }
    let i = 0;
    while (i < data.length - 1) {
      if (data[i] !== 0xff) break;
      const m = data[i + 1];
      if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
        const h = data.readUInt16BE(i + 5);
        const w = data.readUInt16BE(i + 7);
        return [w, h];
      } else if (m === 0xd8 || m === 0xd9 || m === 0xff) {
        i += 2;
      } else {
        const ln = data.readUInt16BE(i + 2);
        i += 2 + ln;
      }
    }
  } catch {}
  return [800, 600];
}

export const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
  '.dwg': 'application/acad',
  '.ifc': 'application/octet-stream',
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export { path };
