package com.yourcompany;

import me.zhyd.oauth.config.AuthConfig;
import me.zhyd.oauth.request.AuthRequest;
import me.zhyd.oauth.AuthRequestBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;

/**
 * 腾讯云函数 - JustAuth 授权处理
 * 
 * 执行方法配置：com.yourcompany.AuthHandler::mainHandler
 * 
 * 注意：腾讯云开发的 Java 云函数使用标准的 Map<String, Object> 作为参数
 */
public class AuthHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthHandler.class);
    private static final Gson gson = new Gson();
    
    /**
     * 云函数主入口方法
     * 
     * @param event 请求事件，包含请求的所有信息
     * @return 响应结果，包含 statusCode、headers、body 等
     */
    public Map<String, Object> mainHandler(Map<String, Object> event) {
        
        logger.info("收到请求: {}", gson.toJson(event));
        
        try {
            // 解析请求参数
            // 腾讯云开发的请求格式：event 中包含 requestContext、path、httpMethod、queryString 等
            Map<String, Object> requestContext = (Map<String, Object>) event.get("requestContext");
            String path = (String) event.get("path");
            String httpMethod = (String) event.get("httpMethod");
            String queryString = (String) event.get("queryString");
            
            Map<String, String> queryParams = queryString != null 
                ? parseQueryString(queryString) 
                : new HashMap<>();
            
            // 根据路径和方法处理不同的请求
            if ("/auth/github".equals(path) && "GET".equals(httpMethod)) {
                return handleGithubAuth(queryParams);
            } else if ("/auth/callback".equals(path) && "GET".equals(httpMethod)) {
                return handleAuthCallback(queryParams);
            } else {
                return createResponse(404, "Not Found", null);
            }
            
        } catch (Exception e) {
            logger.error("处理请求时发生错误", e);
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return createResponse(500, "Internal Server Error", errorResponse);
        }
    }
    
    /**
     * 处理 GitHub 授权请求
     */
    private Map<String, Object> handleGithubAuth(Map<String, String> queryParams) {
        // 从环境变量或配置中获取 GitHub OAuth 配置
        // 注意：实际使用时应该从云函数环境变量或配置文件中读取
        String clientId = System.getenv("GITHUB_CLIENT_ID");
        String clientSecret = System.getenv("GITHUB_CLIENT_SECRET");
        String redirectUri = System.getenv("GITHUB_REDIRECT_URI");
        
        if (clientId == null || clientSecret == null || redirectUri == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "GitHub OAuth 配置未设置");
            return createResponse(500, "Configuration Error", error);
        }
        
        // 创建 JustAuth 请求
        AuthRequest authRequest = AuthRequestBuilder.builder()
            .source("github")
            .authConfig(AuthConfig.builder()
                .clientId(clientId)
                .clientSecret(clientSecret)
                .redirectUri(redirectUri)
                .build())
            .build();
        
        // 生成授权 URL
        String authorizeUrl = authRequest.authorize("state");
        
        // 直接重定向到授权 URL
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 302);
        Map<String, String> headers = new HashMap<>();
        headers.put("Location", authorizeUrl);
        response.put("headers", headers);
        return response;
    }
    
    /**
     * 处理授权回调
     */
    private Map<String, Object> handleAuthCallback(Map<String, String> queryParams) {
        String code = queryParams.get("code");
        String state = queryParams.get("state");
        
        if (code == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "缺少授权码");
            return createResponse(400, "Bad Request", error);
        }
        
        // 使用 JustAuth 获取用户信息
        // 这里需要根据实际情况实现
        Map<String, String> response = new HashMap<>();
        response.put("message", "授权成功");
        response.put("code", code);
        
        return createResponse(200, "OK", response);
    }
    
    /**
     * 解析查询字符串
     */
    private Map<String, String> parseQueryString(String queryString) {
        Map<String, String> params = new HashMap<>();
        if (queryString != null && !queryString.isEmpty()) {
            String[] pairs = queryString.split("&");
            for (String pair : pairs) {
                String[] keyValue = pair.split("=", 2);
                if (keyValue.length == 2) {
                    params.put(keyValue[0], keyValue[1]);
                }
            }
        }
        return params;
    }
    
    /**
     * 创建标准响应
     */
    private Map<String, Object> createResponse(
            int statusCode, 
            String statusDescription, 
            Object body) {
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", statusCode);
        response.put("statusDescription", statusDescription);
        
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        response.put("headers", headers);
        
        if (body != null) {
            response.put("body", gson.toJson(body));
        } else {
            response.put("body", "");
        }
        
        return response;
    }
}

