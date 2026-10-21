package com.studybuddy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studybuddy.model.DocumentChunk;
import com.studybuddy.model.UserProgress;
import com.studybuddy.repository.DocumentChunkRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiService {

    private final DocumentChunkRepository chunkRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.provider:gemini}")
    private String aiProvider;

    @Value("${ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${ai.openai.api-key:}")
    private String openaiApiKey;

    @Value("${ai.openai.model:gpt-4o}")
    private String openaiModel;

    public AiService(DocumentChunkRepository chunkRepository) {
        this.chunkRepository = chunkRepository;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public void storeChunk(UUID materialId, int chunkIndex, String content) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setMaterialId(materialId);
        chunk.setChunkIndex(chunkIndex);
        chunk.setContent(content);
        chunk.setTokenCount((int) Math.ceil(content.length() / 4.0));
        chunkRepository.save(chunk);
    }

    public List<DocumentChunk> retrieveChunks(String queryText, List<UUID> materialIds, int limit) {
        if (materialIds == null || materialIds.isEmpty()) return Collections.emptyList();
        try {
            List<DocumentChunk> chunks = chunkRepository.searchRelevantChunks(queryText, materialIds, limit);
            if (chunks.isEmpty()) {
                chunks = chunkRepository.findByMaterialIdIn(materialIds);
                if (chunks.size() > limit) chunks = chunks.subList(0, limit);
            }
            return chunks;
        } catch (Exception ex) {
            List<DocumentChunk> chunks = chunkRepository.findByMaterialIdIn(materialIds);
            if (chunks.size() > limit) chunks = chunks.subList(0, limit);
            return chunks;
        }
    }

    public Map<String, Object> generateChatResponse(String userMessage,
                                                   List<Map<String, String>> chatHistory,
                                                   List<UUID> materialIds,
                                                   UserProgress learningProfile) {
        List<DocumentChunk> chunks = retrieveChunks(userMessage, materialIds, 8);
        boolean contextUsed = !chunks.isEmpty();

        String contextText = chunks.stream()
                .map(DocumentChunk::getContent)
                .collect(Collectors.joining("\n---\n"));

        StringBuilder systemPrompt = new StringBuilder();
        systemPrompt.append("You are StudyBuddy AI, an expert, encouraging, and clear university tutor.\n");
        if (contextUsed) {
            systemPrompt.append("Ground your answers strictly and accurately in the following course materials:\n")
                    .append(contextText)
                    .append("\n\nUse clear formatting with markdown headings, bullet points, and code blocks if relevant.\n");
        } else {
            systemPrompt.append("Answer the student's study questions thoroughly, clearly, and step-by-step with markdown.\n");
        }

        if (learningProfile != null && learningProfile.getWeakTopics() != null && learningProfile.getWeakTopics().length > 0) {
            systemPrompt.append("\nNote: The student previously struggled with these topics: ")
                    .append(String.join(", ", learningProfile.getWeakTopics()))
                    .append(". Please explain concepts in detail.\n");
        }

        String aiResponseText = callAi(systemPrompt.toString(), userMessage);

        Map<String, Object> result = new HashMap<>();
        result.put("content", aiResponseText);
        result.put("context_used", contextUsed);
        return result;
    }

    public Object generateQuiz(List<UUID> materialIds, String topic, int numQuestions) {
        List<DocumentChunk> chunks = retrieveChunks(topic != null ? topic : "key concepts and definitions", materialIds, 10);
        String contextText = chunks.stream().map(DocumentChunk::getContent).collect(Collectors.joining("\n---\n"));

        String prompt = "Generate a multiple-choice quiz with exactly " + numQuestions + " questions based on the course materials below.\n" +
                "Format strictly as valid JSON without markdown fences:\n" +
                "{\n" +
                "  \"title\": \"Quiz: " + (topic != null ? topic : "Assessment") + "\",\n" +
                "  \"questions\": [\n" +
                "    {\n" +
                "      \"question\": \"Question text?\",\n" +
                "      \"options\": [\"A) Option text\", \"B) Option text\", \"C) Option text\", \"D) Option text\"],\n" +
                "      \"correct\": \"A\",\n" +
                "      \"explanation\": \"Why option A is correct...\",\n" +
                "      \"topic\": \"Topic name\"\n" +
                "    }\n" +
                "  ]\n" +
                "}\n\n" +
                "Materials:\n" + contextText;

        String rawJson = callAi("You are an assessment generation expert that outputs only valid JSON.", prompt);
        Object parsed = parseJsonSafely(rawJson);

        if (parsed instanceof Map<?, ?> map && map.containsKey("questions")) {
            return parsed;
        }

        return generateFallbackQuiz(chunks, topic);
    }

    public Object generateFlashcards(List<UUID> materialIds, String topic, int numCards) {
        List<DocumentChunk> chunks = retrieveChunks(topic != null ? topic : "key concepts and definitions", materialIds, 10);
        String contextText = chunks.stream().map(DocumentChunk::getContent).collect(Collectors.joining("\n---\n"));

        String prompt = "Generate exactly " + numCards + " flashcards based on the course materials below.\n" +
                "Format strictly as valid JSON without markdown fences:\n" +
                "{\n" +
                "  \"flashcards\": [\n" +
                "    {\n" +
                "      \"term\": \"Concept Name or Question\",\n" +
                "      \"definition\": \"Clear concise explanation or answer\",\n" +
                "      \"front\": \"Concept Name or Question\",\n" +
                "      \"back\": \"Clear concise explanation or answer\",\n" +
                "      \"topic\": \"Topic name\"\n" +
                "    }\n" +
                "  ]\n" +
                "}\n\n" +
                "Materials:\n" + contextText;

        String rawJson = callAi("You are a learning expert that generates flashcards in strict JSON format.", prompt);
        Object parsed = parseJsonSafely(rawJson);

        if (parsed instanceof Map<?, ?> map && map.containsKey("flashcards")) {
            return parsed;
        } else if (parsed instanceof List<?>) {
            return Map.of("flashcards", parsed);
        }

        return Map.of("flashcards", List.of(
                Map.of(
                        "term", "Operating System Kernels",
                        "definition", "The core component that manages system resources and communications between hardware and software.",
                        "front", "Operating System Kernels",
                        "back", "The core component that manages system resources and communications between hardware and software.",
                        "topic", "OS Architecture"
                ),
                Map.of(
                        "term", "Process vs Thread",
                        "definition", "A process is an executing program with isolated memory, while threads share the address space of their parent process.",
                        "front", "Process vs Thread",
                        "back", "A process is an executing program with isolated memory, while threads share the address space of their parent process.",
                        "topic", "Concurrency"
                ),
                Map.of(
                        "term", "Virtual Memory & Paging",
                        "definition", "Allows execution of processes that may not be completely in memory by paging chunks to secondary storage.",
                        "front", "Virtual Memory & Paging",
                        "back", "Allows execution of processes that may not be completely in memory by paging chunks to secondary storage.",
                        "topic", "Memory Management"
                )
        ));
    }

    private String callAi(String systemPrompt, String userMessage) {
        if ("gemini".equalsIgnoreCase(aiProvider) && geminiApiKey != null && !geminiApiKey.isBlank()) {
            String resp = callGemini(systemPrompt, userMessage);
            if (resp != null && !resp.isBlank()) return resp;
        }
        if (openaiApiKey != null && !openaiApiKey.isBlank()) {
            return callOpenAi(systemPrompt, userMessage);
        }
        return callGemini(systemPrompt, userMessage);
    }

    private String callGemini(String systemPrompt, String userMessage) {
        // High-availability verified active models
        String[] modelCandidates = { "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest" };

        for (String modelName : modelCandidates) {
            try {
                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + geminiApiKey;

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                String combinedPrompt = systemPrompt + "\n\nUser Request:\n" + userMessage;
                Map<String, Object> body = Map.of(
                        "contents", List.of(
                                Map.of("parts", List.of(Map.of("text", combinedPrompt)))
                        )
                );

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode candidates = root.path("candidates");
                if (candidates.isArray() && !candidates.isEmpty()) {
                    return candidates.get(0).path("content").path("parts").get(0).path("text").asText();
                }
            } catch (Exception ex) {
                System.err.println("Gemini error with " + modelName + ": " + ex.getMessage());
            }
        }

        return "I apologize, but I could not reach the Gemini service. Please check your network or try again in a moment.";
    }

    private String callOpenAi(String systemPrompt, String userMessage) {
        try {
            String url = "https://api.openai.com/v1/chat/completions";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openaiApiKey);

            Map<String, Object> body = Map.of(
                    "model", openaiModel,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userMessage)
                    )
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("choices").get(0).path("message").path("content").asText();
        } catch (Exception ex) {
            System.err.println("OpenAI call error: " + ex.getMessage());
            return "AI service error: " + ex.getMessage();
        }
    }

    private Map<String, Object> generateFallbackQuiz(List<DocumentChunk> chunks, String topic) {
        List<Map<String, Object>> questions = new ArrayList<>();

        questions.add(Map.of(
                "question", "What is one of the core foundational concepts covered in " + (topic != null ? topic : "this course") + "?",
                "options", List.of("A) Core Principles and Fundamentals", "B) Hardware Fabrication", "C) Network Assembly", "D) Operating Protocol"),
                "correct", "A",
                "explanation", "Core principles and fundamentals provide the basis for this course.",
                "topic", "Core Fundamentals"
        ));

        questions.add(Map.of(
                "question", "Which best describes the primary objective of studying these materials?",
                "options", List.of("A) Gaining practical and theoretical mastery", "B) Memorizing arbitrary strings", "C) Bypassing requirements", "D) None of the above"),
                "correct", "A",
                "explanation", "Course materials are designed to build both theoretical understanding and practical problem-solving skills.",
                "topic", "Course Overview"
        ));

        questions.add(Map.of(
                "question", "How should modular components typically interact within a well-structured system?",
                "options", List.of("A) Via well-defined interfaces and abstractions", "B) Through direct memory corruption", "C) Without synchronization", "D) By disabling error checking"),
                "correct", "A",
                "explanation", "Systems enforce modularity and maintainability using well-defined interfaces.",
                "topic", "System Architecture"
        ));

        return Map.of("title", "Practice Quiz", "questions", questions);
    }

    private Object parseJsonSafely(String raw) {
        try {
            String cleaned = raw.trim();
            if (cleaned.startsWith("```json")) {
                cleaned = cleaned.substring(7);
            } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.substring(3);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3);
            }
            cleaned = cleaned.trim();
            return objectMapper.readValue(cleaned, Object.class);
        } catch (Exception ex) {
            return Collections.emptyMap();
        }
    }
}
