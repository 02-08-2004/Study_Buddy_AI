const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from a Buffer based on file type
 */
const extractText = async (buffer, mimeType, fileName = '') => {
  try {
    // PDF
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return cleanText(data.text);
    }

    // Word documents
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return cleanText(result.value);
    }

    // PowerPoint (exported as PPTX from Google Slides)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileName.endsWith('.pptx')
    ) {
      // For PPTX, we do basic XML text extraction
      return await extractPptxText(buffer);
    }

    // Plain text
    if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      return cleanText(buffer.toString('utf-8'));
    }

    // Google Docs exported as docx
    const text = buffer.toString('utf-8');
    if (text.includes('<?xml') || text.includes('<html')) {
      return cleanText(text.replace(/<[^>]*>/g, ' '));
    }

    return cleanText(text);
  } catch (err) {
    console.error('Text extraction error:', err.message);
    return null;
  }
};

/**
 * Basic PPTX text extraction via XML parsing
 */
const extractPptxText = async (buffer) => {
  try {
    // PPTX is a ZIP file — use basic string extraction
    const content = buffer.toString('binary');
    // Find all text runs between <a:t> tags
    const matches = content.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    const texts = matches.map(m => m.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
    return cleanText(texts.join('\n'));
  } catch (err) {
    return '';
  }
};

/**
 * Clean and normalize extracted text
 */
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .trim();
};

/**
 * Split text into overlapping chunks for RAG
 */
const chunkText = (text, chunkSize = 800, overlap = 150) => {
  if (!text || text.length === 0) return [];

  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep overlap
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + '\n\n' + paragraph;
      } else {
        // Single paragraph longer than chunk size - split by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= chunkSize) {
            currentChunk += ' ' + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 30);
};

module.exports = { extractText, chunkText, cleanText };
