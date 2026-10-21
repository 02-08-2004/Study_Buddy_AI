package com.studybuddy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class GoogleClassroomService {

    private static final String CLASSROOM_BASE = "https://classroom.googleapis.com/v1";
    private static final String DRIVE_BASE = "https://www.googleapis.com/drive/v3";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public GoogleClassroomService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public List<Map<String, Object>> getCourses(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url = CLASSROOM_BASE + "/courses?courseStates=ACTIVE&pageSize=50";
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode coursesNode = root.get("courses");

            List<Map<String, Object>> courses = new ArrayList<>();
            if (coursesNode != null && coursesNode.isArray()) {
                for (JsonNode c : coursesNode) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", c.has("id") ? c.get("id").asText() : null);
                    map.put("name", c.has("name") ? c.get("name").asText() : null);
                    map.put("section", c.has("section") ? c.get("section").asText() : null);
                    map.put("descriptionHeading", c.has("descriptionHeading") ? c.get("descriptionHeading").asText() : null);
                    map.put("description", c.has("description") ? c.get("description").asText() : null);

                    if (c.has("teacherFolder") && c.get("teacherFolder").has("id")) {
                        map.put("teacherFolderId", c.get("teacherFolder").get("id").asText());
                    }
                    courses.add(map);
                }
            }
            return courses;
        } catch (Exception ex) {
            System.err.println("Google Classroom courses error: " + ex.getMessage());
            return Collections.emptyList();
        }
    }

    public List<Map<String, Object>> getCourseMaterials(String accessToken, String courseId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url = CLASSROOM_BASE + "/courses/" + courseId + "/courseWorkMaterials?pageSize=100";
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode materialsNode = root.get("courseWorkMaterial");

            List<Map<String, Object>> materialsList = new ArrayList<>();
            if (materialsNode != null && materialsNode.isArray()) {
                for (JsonNode m : materialsNode) {
                    String materialId = m.has("id") ? m.get("id").asText() : "";
                    String materialTitle = m.has("title") ? m.get("title").asText() : "Untitled";

                    if (m.has("materials") && m.get("materials").isArray()) {
                        for (JsonNode attachment : m.get("materials")) {
                            if (attachment.has("driveFile")) {
                                JsonNode df = attachment.get("driveFile");
                                if (df.has("driveFile")) df = df.get("driveFile");

                                Map<String, Object> item = new HashMap<>();
                                item.put("classroom_material_id", materialId);
                                item.put("drive_file_id", df.has("id") ? df.get("id").asText() : null);
                                item.put("file_name", df.has("title") ? df.get("title").asText() : "Untitled");
                                item.put("file_type", "drive");
                                item.put("material_title", materialTitle);
                                materialsList.add(item);
                            } else if (attachment.has("link")) {
                                JsonNode link = attachment.get("link");
                                Map<String, Object> item = new HashMap<>();
                                item.put("classroom_material_id", materialId);
                                item.put("drive_file_id", null);
                                item.put("file_url", link.has("url") ? link.get("url").asText() : "");
                                item.put("file_name", link.has("title") ? link.get("title").asText() : link.get("url").asText());
                                item.put("file_type", "link");
                                item.put("material_title", materialTitle);
                                materialsList.add(item);
                            }
                        }
                    }
                }
            }
            return materialsList;
        } catch (Exception ex) {
            System.err.println("Google Classroom materials error: " + ex.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getDriveFileInfo(String accessToken, String fileId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url = DRIVE_BASE + "/files/" + fileId + "?fields=id,name,mimeType,size";
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            Map<String, Object> res = new HashMap<>();
            res.put("id", root.has("id") ? root.get("id").asText() : fileId);
            res.put("name", root.has("name") ? root.get("name").asText() : "Untitled");
            res.put("mimeType", root.has("mimeType") ? root.get("mimeType").asText() : "application/pdf");
            res.put("size", root.has("size") ? root.get("size").asLong() : 0L);
            return res;
        } catch (Exception ex) {
            throw new RuntimeException("Error fetching drive file: " + ex.getMessage());
        }
    }

    public byte[] downloadDriveFile(String accessToken, String fileId, String mimeType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url;
            if (mimeType != null && mimeType.startsWith("application/vnd.google-apps.")) {
                String exportMime = "application/pdf";
                if ("application/vnd.google-apps.document".equals(mimeType)) {
                    exportMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
                url = DRIVE_BASE + "/files/" + fileId + "/export?mimeType=" + exportMime;
            } else {
                url = DRIVE_BASE + "/files/" + fileId + "?alt=media";
            }

            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, entity, byte[].class);
            return response.getBody();
        } catch (Exception ex) {
            throw new RuntimeException("Error downloading drive file: " + ex.getMessage());
        }
    }
}
