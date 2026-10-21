package com.studybuddy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studybuddy.model.User;
import com.studybuddy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class GoogleOAuthService {

    private final UserRepository userRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${google.client.id}")
    private String clientId;

    @Value("${google.client.secret}")
    private String clientSecret;

    @Value("${google.callback.url}")
    private String callbackUrl;

    public GoogleOAuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public String buildAuthorizationUrl() {
        String scopes = String.join(" ",
                "profile",
                "email",
                "https://www.googleapis.com/auth/classroom.courses.readonly",
                "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
                "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
                "https://www.googleapis.com/auth/drive.readonly"
        );

        return UriComponentsBuilder.fromHttpUrl("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", callbackUrl)
                .queryParam("response_type", "code")
                .queryParam("scope", scopes)
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .build()
                .toUriString();
    }

    public User processOAuthCallback(String code) {
        try {
            // 1. Exchange authorization code for tokens
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code", code);
            params.add("client_id", clientId);
            params.add("client_secret", clientSecret);
            params.add("redirect_uri", callbackUrl);
            params.add("grant_type", "authorization_code");

            HttpEntity<MultiValueMap<String, String>> tokenRequest = new HttpEntity<>(params, tokenHeaders);
            ResponseEntity<String> tokenResponse = restTemplate.postForEntity(
                    "https://oauth2.googleapis.com/token",
                    tokenRequest,
                    String.class
            );

            JsonNode tokenJson = objectMapper.readTree(tokenResponse.getBody());
            String accessToken = tokenJson.has("access_token") ? tokenJson.get("access_token").asText() : null;
            String refreshToken = tokenJson.has("refresh_token") ? tokenJson.get("refresh_token").asText() : null;
            int expiresIn = tokenJson.has("expires_in") ? tokenJson.get("expires_in").asInt() : 3600;

            // 2. Fetch user profile from Google UserInfo endpoint
            HttpHeaders profileHeaders = new HttpHeaders();
            profileHeaders.setBearerAuth(accessToken);
            HttpEntity<Void> profileRequest = new HttpEntity<>(profileHeaders);

            ResponseEntity<String> profileResponse = restTemplate.exchange(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    HttpMethod.GET,
                    profileRequest,
                    String.class
            );

            JsonNode profileJson = objectMapper.readTree(profileResponse.getBody());
            String googleId = profileJson.get("id").asText();
            String email = profileJson.has("email") ? profileJson.get("email").asText() : "";
            String name = profileJson.has("name") ? profileJson.get("name").asText() : email;
            String avatarUrl = profileJson.has("picture") ? profileJson.get("picture").asText() : null;

            LocalDateTime tokenExpiry = LocalDateTime.now().plusSeconds(expiresIn);

            // 3. Upsert user in database
            Optional<User> existingUserOpt = userRepository.findByGoogleAccountId(googleId);
            User user;
            if (existingUserOpt.isPresent()) {
                user = existingUserOpt.get();
                user.setName(name);
                user.setEmail(email);
                user.setAvatarUrl(avatarUrl);
                user.setAccessToken(accessToken);
                if (refreshToken != null && !refreshToken.isBlank()) {
                    user.setRefreshToken(refreshToken);
                }
                user.setAccessTokenExpiry(tokenExpiry);
                user.setUpdatedAt(LocalDateTime.now());
            } else {
                user = new User();
                user.setGoogleAccountId(googleId);
                user.setName(name);
                user.setEmail(email);
                user.setAvatarUrl(avatarUrl);
                user.setAccessToken(accessToken);
                user.setRefreshToken(refreshToken);
                user.setAccessTokenExpiry(tokenExpiry);
                user.setCreatedAt(LocalDateTime.now());
                user.setUpdatedAt(LocalDateTime.now());
            }

            return userRepository.save(user);

        } catch (Exception ex) {
            throw new RuntimeException("Failed to process Google OAuth callback: " + ex.getMessage(), ex);
        }
    }
}
