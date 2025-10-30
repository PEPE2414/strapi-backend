import type { Context } from 'koa';

async function extractTextFromFileId(fileId: number): Promise<string> {
  const f = await strapi.entityService.findOne('plugin::upload.file', fileId);
  if (!f) throw new Error('file_not_found');

  const mime = String(f.mime || '').toLowerCase();
  const ext = String(f.ext || '').toLowerCase();

  let buf: Buffer | null = null;
  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    if (!region || !bucket) throw new Error('missing_s3_env');
    const keyFromProvider = (f as any)?.provider_metadata?.key as string | undefined;
    let key = keyFromProvider;
    if (!key) {
      const url = String(f.url || '');
      if (!url) throw new Error('no_file_url');
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      key = path.replace(/^\/+/, '');
    }
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    });
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key! }));
    // @ts-ignore
    const bytes = await out.Body?.transformToByteArray();
    if (bytes) buf = Buffer.from(bytes);
  } catch (e: any) {
    strapi.log.warn('[cv-refiner] S3 fetch failed, fallback to HTTP: ' + e?.message);
  }

  if (!buf) {
    const url = String(f.url || '');
    if (!url.startsWith('http')) throw new Error('no_absolute_url_for_http_fetch');
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    buf = Buffer.from(ab);
  }

  let text = '';
  try {
    if (ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
      const pdfMod = await import('pdf-parse');
      const pdfParse: any = (pdfMod as any).default || (pdfMod as any);
      const out = await pdfParse(buf);
      text = (out?.text || '').trim();
    } else if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mmMod = await import('mammoth');
      const mammoth: any = (mmMod as any).default || (mmMod as any);
      const out = await mammoth.extractRawText({ buffer: buf });
      text = (out?.value || '').trim();
    }
  } catch (e: any) {
    strapi.log.warn('[cv-refiner] extraction error: ' + e?.message);
  }
  return text || '';
}

export default {
  async refine(ctx: Context) {
    const auth = ctx.state.user;
    if (!auth) return ctx.unauthorized('Authentication required');

    const body = ctx.request.body || {};
    const source = String(body.source || 'paste');
    const industry = String(body.industry || '');
    const subrole = String(body.subrole || '');
    const tangible = String(body.tangible || '');

    let cvText = String(body.text || '').trim();

    if (source === 'upload') {
      const fileId = Number(body.fileId);
      if (!fileId) return ctx.badRequest('fileId required for upload source');
      cvText = await extractTextFromFileId(fileId);
      if (!cvText) return ctx.badRequest('No extractable text in uploaded file');
    } else if (!cvText) {
      return ctx.badRequest('text is required');
    }

    const webhook = process.env.CV_N8N_WEBHOOK_URL;
    if (!webhook) return ctx.badRequest('Webhook not configured');

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.id,
          industry,
          subrole,
          tangible,
          cvText,
          meta: { source: source, userEmail: auth.email }
        }),
      });
      const ok = res.ok;
      let payload: any = null;
      try { payload = await res.json(); } catch { payload = { status: res.status }; }
      ctx.body = { ok, data: payload };
    } catch (e: any) {
      strapi.log.error('[cv-refiner] webhook call failed: ' + e?.message);
      ctx.throw(500, 'Webhook call failed');
    }
  },
};


