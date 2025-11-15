import { gunzip, inflate, brotliDecompress } from 'zlib';
import { promisify } from 'util';
import { Readable } from 'stream';

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Detects if data is binary/compressed
 */
function isBinaryData(data: Buffer | string): boolean {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary');
  if (buffer.length < 2) return false;
  
  // Check for binary control characters in first 100 bytes
  const sample = buffer.slice(0, Math.min(100, buffer.length));
  const hasBinaryChars = /[\x00-\x08\x0E-\x1F]/.test(sample.toString('binary'));
  
  return hasBinaryChars;
}

/**
 * Detects compression format from magic bytes
 */
function detectCompressionFormat(buffer: Buffer): 'gzip' | 'deflate' | 'brotli' | 'none' {
  if (buffer.length < 2) return 'none';
  
  // Gzip magic bytes: 1F 8B
  if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
    return 'gzip';
  }
  
  // Brotli magic bytes: starts with specific patterns
  // Brotli streams typically start with 0x81 or 0xCE
  if (buffer[0] === 0x81 || buffer[0] === 0xCE) {
    // Check for brotli-specific patterns
    if (buffer.length >= 4) {
      // Brotli window size bits are in first byte
      const windowSize = buffer[0] & 0xE0;
      if (windowSize === 0x80 || windowSize === 0xC0) {
        return 'brotli';
      }
    }
  }
  
  // Deflate/Zlib: 78 9C, 78 01, 78 DA, 78 5E are common
  if (buffer[0] === 0x78 && (buffer[1] === 0x9C || buffer[1] === 0x01 || buffer[1] === 0xDA || buffer[1] === 0x5E)) {
    return 'deflate';
  }
  
  return 'none';
}

/**
 * Decompresses binary data based on detected format
 */
async function decompressBuffer(buffer: Buffer, format: 'gzip' | 'deflate' | 'brotli'): Promise<Buffer> {
  try {
    switch (format) {
      case 'gzip':
        return await gunzipAsync(buffer);
      case 'deflate':
        return await inflateAsync(buffer);
      case 'brotli':
        return await brotliDecompressAsync(buffer);
      default:
        throw new Error(`Unknown compression format: ${format}`);
    }
  } catch (error) {
    // If decompression fails, try alternative methods
    if (format === 'deflate') {
      // Try raw deflate (without zlib wrapper)
      try {
        const { inflateRaw } = require('zlib');
        const inflateRawAsync = promisify(inflateRaw);
        return await inflateRawAsync(buffer);
      } catch {
        // If that fails, return original buffer
        throw error;
      }
    }
    throw error;
  }
}

/**
 * Modular function to handle binary/compressed responses
 * Attempts to detect and decompress gzip, deflate, or brotli compressed data
 * 
 * @param data - The response data (Buffer or string)
 * @param contentType - Optional Content-Type header to help with detection
 * @param contentEncoding - Optional Content-Encoding header
 * @returns Decompressed text string, or original string if not compressed
 */
export async function decompressResponse(
  data: Buffer | string,
  contentType?: string,
  contentEncoding?: string
): Promise<string> {
  // If it's already a string and looks like valid text, return as-is
  if (typeof data === 'string') {
    // Check if it's valid UTF-8 text (not binary)
    const hasValidText = /^[\x20-\x7E\n\r\t]*$/.test(data.substring(0, 200)) || 
                         /<[a-zA-Z]|<\?xml|<!DOCTYPE/i.test(data);
    
    if (hasValidText && !isBinaryData(data)) {
      return data;
    }
    
    // Convert string to buffer for processing
    data = Buffer.from(data, 'binary');
  }
  
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  // If buffer is empty or too small, return as string
  if (buffer.length < 2) {
    return buffer.toString('utf-8');
  }
  
  // Check Content-Encoding header first (most reliable)
  if (contentEncoding) {
    const encoding = contentEncoding.toLowerCase().trim();
    try {
      if (encoding.includes('gzip')) {
        const decompressed = await gunzipAsync(buffer);
        return decompressed.toString('utf-8');
      } else if (encoding.includes('deflate')) {
        const decompressed = await inflateAsync(buffer);
        return decompressed.toString('utf-8');
      } else if (encoding.includes('br') || encoding.includes('brotli')) {
        const decompressed = await brotliDecompressAsync(buffer);
        return decompressed.toString('utf-8');
      }
    } catch (error) {
      console.warn(`⚠️  Failed to decompress with Content-Encoding "${contentEncoding}":`, error instanceof Error ? error.message : String(error));
      // Fall through to auto-detection
    }
  }
  
  // Auto-detect compression format if not specified
  if (isBinaryData(buffer)) {
    const format = detectCompressionFormat(buffer);
    
    if (format !== 'none') {
      try {
        console.log(`🔓 Detected ${format} compression, attempting decompression...`);
        const decompressed = await decompressBuffer(buffer, format);
        const text = decompressed.toString('utf-8');
        
        // Validate that decompression produced valid text
        if (text.length > 0 && (text.includes('<') || text.includes('{') || /^[\x20-\x7E\n\r\t]*$/.test(text.substring(0, 100)))) {
          console.log(`✅ Successfully decompressed ${format} data (${buffer.length} → ${text.length} chars)`);
          return text;
        } else {
          console.warn(`⚠️  Decompression produced invalid text, returning original`);
          return buffer.toString('utf-8', 0, Math.min(buffer.length, 10000)); // Limit output
        }
      } catch (error) {
        console.warn(`⚠️  Failed to decompress ${format} data:`, error instanceof Error ? error.message : String(error));
        // Try to return as UTF-8 string anyway (might be partially readable)
        try {
          return buffer.toString('utf-8');
        } catch {
          // If UTF-8 fails, try latin1
          return buffer.toString('latin1');
        }
      }
    }
  }
  
  // Not compressed or decompression failed - try to return as text
  try {
    // Try UTF-8 first
    const utf8 = buffer.toString('utf-8');
    // Check if it's valid UTF-8 (not too many replacement characters)
    const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
    if (replacementCount < buffer.length * 0.1) { // Less than 10% replacement chars
      return utf8;
    }
  } catch {
    // UTF-8 failed
  }
  
  // Fallback to latin1
  try {
    return buffer.toString('latin1');
  } catch {
    // Last resort: return first 1000 chars as hex for debugging
    return buffer.toString('hex').substring(0, 2000);
  }
}

/**
 * Helper function to decompress response from undici request
 * Extracts data from response body and handles decompression
 */
export async function decompressUndiciResponse(
  body: any,
  headers?: Record<string, string | string[] | undefined>
): Promise<string> {
  // Get Content-Encoding from headers
  const contentEncoding = headers?.['content-encoding'] || headers?.['Content-Encoding'];
  const encoding = Array.isArray(contentEncoding) ? contentEncoding[0] : contentEncoding;
  
  // Get content as buffer
  const buffer = await body.arrayBuffer().then((ab: ArrayBuffer) => Buffer.from(ab));
  
  return decompressResponse(buffer, undefined, encoding);
}

/**
 * Helper function to decompress response from fetch API
 */
export async function decompressFetchResponse(response: Response): Promise<string> {
  const contentEncoding = response.headers.get('content-encoding');
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return decompressResponse(buffer, response.headers.get('content-type') || undefined, contentEncoding || undefined);
}

