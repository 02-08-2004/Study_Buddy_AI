package com.studybuddy.controller;

import com.studybuddy.config.JwtUtils;
import com.studybuddy.model.User;
import com.studybuddy.service.GoogleOAuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final GoogleOAuthService oAuthService;
    private final JwtUtils jwtUtils;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public AuthController(GoogleOAuthService oAuthService, JwtUtils jwtUtils) {
        this.oAuthService = oAuthService;
        this.jwtUtils = jwtUtils;
    }

    @GetMapping("/google")
    public void initiateGoogleOAuth(HttpServletResponse response) throws IOException {
        String authUrl = oAuthService.buildAuthorizationUrl();
        response.sendRedirect(authUrl);
    }

    @GetMapping("/google/callback")
    public void googleOAuthCallback(@RequestParam(value = "code", required = false) String code,
                                    @RequestParam(value = "error", required = false) String error,
                                    HttpServletResponse response) throws IOException {
        if (error != null || code == null) {
            response.sendRedirect(frontendUrl + "/login?error=" + (error != null ? error : "auth_failed"));
            return;
        }

        try {
            User user = oAuthService.processOAuthCallback(code);
            String token = jwtUtils.generateToken(user.getId(), user.getEmail());
            response.sendRedirect(frontendUrl + "/login/callback?token=" + token);
        } catch (Exception ex) {
            System.err.println("OAuth callback error: " + ex.getMessage());
            response.sendRedirect(frontendUrl + "/login?error=auth_failed");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}
