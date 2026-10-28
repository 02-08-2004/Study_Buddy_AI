package com.studybuddy.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DocumentParserService {

    public String extractText(byte[] buffer, String mimeType, String fileName) {
        if (buffer == null || buffer.length == 0) return "";
        String fName = fileName != null ? fileName.toLowerCase() : "";
        String mType = mimeType != null ? mimeType.toLowerCase() : "";

        try {
            if (mType.startsWith("video/") || mType.startsWith("audio/") || mType.startsWith("image/")
                    || fName.matches(".*\\.(mp4|mov|avi|mkv|webm|flv|wmv|mp3|wav|m4a|aac|ogg|flac|png|jpg|jpeg|gif|webp|svg|zip|rar|7z|tar|gz|exe|bin|iso|dmg|dll)$")) {
                return "";
            }

            // PDF
            if (mType.contains("pdf") || fName.endsWith(".pdf")) {
                try (PDDocument document = Loader.loadPDF(buffer)) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    return cleanText(stripper.getText(document));
                }
            }

            // PowerPoint (.pptx / Google Slides export)
            if (mType.contains("presentation") || fName.endsWith(".pptx") || fName.endsWith(".ppt")) {
                try {
                    String content = new String(buffer, StandardCharsets.ISO_8859_1);
                    Matcher m = Pattern.compile("<a:t[^>]*>([^<]+)</a:t>").matcher(content);
                    StringBuilder sb = new StringBuilder();
                    while (m.find()) {
                        sb.append(m.group(1)).append(" ");
                    }
                    if (sb.length() > 20) {
                        return cleanText(sb.toString());
                    }
                } catch (Exception ignored) {}
            }

            // Word Documents (.docx)
            if (mType.contains("word") || mType.contains("wordprocessingml") || fName.endsWith(".docx") || fName.endsWith(".doc")) {
                try (ByteArrayInputStream bais = new ByteArrayInputStream(buffer);
                     XWPFDocument doc = new XWPFDocument(bais);
                     XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
                    return cleanText(extractor.getText());
                }
            }

            // Plain text (only if mime type or extension is text/code)
            if (mType.startsWith("text/") || mType.contains("json") || mType.contains("csv")
                    || fName.matches(".*\\.(txt|md|csv|json|xml|html|htm|py|java|c|cpp|h|hpp|js|ts|jsx|tsx|css|sql|sh|yaml|yml|r|go|rs|rb)$")) {
                for (int i = 0; i < Math.min(buffer.length, 1024); i++) {
                    if (buffer[i] == 0) return "";
                }
                return cleanText(new String(buffer, StandardCharsets.UTF_8));
            }

            return "";

        } catch (Exception ex) {
            return "";
        }
    }

    public String cleanText(String text) {
        if (text == null) return "";
        return text
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .replaceAll("[ \t]{2,}", " ")
                .replaceAll("[^\\x20-\\x7E\n]", " ")
                .trim();
    }

    public List<String> chunkText(String text, int chunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) return chunks;

        String[] paragraphs = text.split("\n\n");
        StringBuilder currentChunk = new StringBuilder();

        for (String paragraph : paragraphs) {
            String pTrimmed = paragraph.trim();
            if (pTrimmed.length() < 20) continue;

            if (currentChunk.length() + pTrimmed.length() <= chunkSize) {
                if (!currentChunk.isEmpty()) currentChunk.append("\n\n");
                currentChunk.append(pTrimmed);
            } else {
                if (!currentChunk.isEmpty()) {
                    chunks.add(currentChunk.toString().trim());
                    String[] words = currentChunk.toString().split("\\s+");
                    int overlapWordsCount = Math.max(1, Math.min(words.length, overlap / 5));
                    StringBuilder overlapSb = new StringBuilder();
                    for (int i = words.length - overlapWordsCount; i < words.length; i++) {
                        overlapSb.append(words[i]).append(" ");
                    }
                    currentChunk = new StringBuilder(overlapSb.toString().trim()).append("\n\n").append(pTrimmed);
                } else {
                    String[] sentences = pTrimmed.split("(?<=[.!?])\\s+");
                    for (String sentence : sentences) {
                        if (currentChunk.length() + sentence.length() <= chunkSize) {
                            if (!currentChunk.isEmpty()) currentChunk.append(" ");
                            currentChunk.append(sentence);
                        } else {
                            if (!currentChunk.isEmpty()) chunks.add(currentChunk.toString().trim());
                            currentChunk = new StringBuilder(sentence);
                        }
                    }
                }
            }
        }

        if (!currentChunk.toString().trim().isEmpty()) {
            chunks.add(currentChunk.toString().trim());
        }

        return chunks.stream().filter(c -> c.length() > 30).toList();
    }
}
