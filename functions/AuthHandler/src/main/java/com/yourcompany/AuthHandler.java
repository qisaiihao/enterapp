package com.yourcompany;

import com.google.gson.Gson;
import me.zhyd.oauth.config.AuthConfig;
import me.zhyd.oauth.model.AuthCallback;
import me.zhyd.oauth.model.AuthResponse;
import me.zhyd.oauth.model.AuthUser;
import me.zhyd.oauth.request.AuthGithubRequest;
import me.zhyd.oauth.request.AuthRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 腾讯云函数 - JustAuth 授权处理
 *
 * 执行方法配置：com.yourcompany.AuthHandler::mainHandler
 */
public class AuthHandler {

    private static final Logger logger = LoggerFactory.getLogger(AuthHandler.class);
    private static final Gson gson = new Gson();

    /**
     * 云函数主入口方法
     *
     * @param event API 网关触发器传入的请求事件
     * @return 返回给 API 网关的响应
     */
    public Map<String, Object> mainHandler(Map<String, Object> event) {
        // SCF 的 API 网关触发器会将所有 header 的 key 转为小写
        logger.info("收到请求: {}", gson.toJson(event));

        try {
            // 解析核心请求参数
            String path = (String) event.get("path");
            String httpMethod = (String) event.get("httpMethod");
            // API 网关会将 query string 参数解析好放入 queryStringParameters
            Map<String, String> queryParams = (Map<String, String>) event.get("queryStringParameters");
            if (queryParams == null) {
                queryParams = new HashMap<>();
            }

            // 根据路径进行路由分发
            if ("/auth/github".equals(path) && "GET".equals(httpMethod)) {
                // 路由到发起 GitHub 授权的方法
                return handleGithubAuthRedirect();
            } else if ("/auth/callback/github".equals(path) && "GET".equals(httpMethod)) {
                // 路由到处理 GitHub 回调的方法
                return handleGithubAuthCallback(queryParams);
            } else {
                return createResponse(404, "Not Found", "请求的路径不存在");
            }

        } catch (Exception e) {
            logger.error("处理请求时发生未捕获的异常", e);
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Internal Server Error");
            errorResponse.put("message", e.getMessage());
            return createResponse(500, "Error", errorResponse);
        }
    }

    /**
     * 第一步：处理 GitHub 授权请求，生成授权链接并重定向
     */
    private Map<String, Object> handleGithubAuthRedirect() {
        AuthRequest authRequest = getGithubAuthRequest();
        if (authRequest == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "GitHub OAuth 配置缺失，请检查云函数环境变量");
            return createResponse(500, "Configuration Error", error);
        }

        // 生成授权 URL，JustAuth 会自动处理 state
        String authorizeUrl = authRequest.authorize(com.xkcoding.justauth.AuthUtil.generateState());

        // 返回 302 重定向响应
        Map<String, Object> response = new HashMap<>();
        response.put("isBase64Encoded", false);
        response.put("statusCode", 302);
        Map<String, String> headers = new HashMap<>();
        // 关键：Location header 指示浏览器重定向到 GitHub 授权页
        headers.put("Location", authorizeUrl);
        response.put("headers", headers);
        response.put("body", ""); // 重定向响应 body 为空
        return response;
    }

    /**
     * 第二步：处理 GitHub 授权成功后的回调
     */
    private Map<String, Object> handleGithubAuthCallback(Map<String, String> queryParams) {
        AuthRequest authRequest = getGithubAuthRequest();
        if (authRequest == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "GitHub OAuth 配置缺失，请检查云函数环境变量");
            return createResponse(500, "Configuration Error", error);
        }

        // 从 query 参数中获取 code 和 state
        String code = queryParams.get("code");
        String state = queryParams.get("state");

        // 使用 JustAuth 执行登录，它会帮你用 code 换 token，再用 token 获取用户信息
        AuthResponse<AuthUser> authResponse = authRequest.login(AuthCallback.builder().code(code).state(state).build());

        logger.info("JustAuth 响应: {}", gson.toJson(authResponse));

        // 判断 JustAuth 请求是否成功
        if (authResponse.ok()) {
            // 授权成功，获取到了用户信息
            AuthUser userInfo = authResponse.getData();
            // 在这里你可以将用户信息存入数据库，生成你自己的 token 等
            // 为了演示，我们直接将用户信息返回给前端
            return createResponse(200, "OK", userInfo);
        } else {
            // 授权失败
            Map<String, String> error = new HashMap<>();
            error.put("error", "GitHub OAuth failed");
            error.put("message", authResponse.getMsg()); // JustAuth 返回的错误信息
            return createResponse(400, "Bad Request", error);
        }
    }

    /**
     * 辅助方法：创建并配置 AuthRequest
     * 将这部分抽离出来，方便复用
     */
    private AuthRequest getGithubAuthRequest() {
        // 从云函数环境变量中读取敏感配置
        String clientId = System.getenv("GITHUB_CLIENT_ID");
        String clientSecret = System.getenv("GITHUB_CLIENT_SECRET");
        String redirectUri = System.getenv("GITHUB_REDIRECT_URI");

        if (clientId == null || clientSecret == null || redirectUri == null) {
            logger.error("环境变量 GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, 或 GITHUB_REDIRECT_URI 未设置");
            return null;
        }

        return new AuthGithubRequest(AuthConfig.builder()
                .clientId(clientId)
                .clientSecret(clientSecret)
                .redirectUri(redirectUri)
                .build());
    }

    /**
     * 辅助方法：创建符合腾讯云 API 网关格式的响应
     */
    private Map<String, Object> createResponse(int statusCode, String statusDescription, Object body) {
        Map<String, Object> response = new HashMap<>();
        response.put("isBase64Encoded", false); // 响应体是否为 Base64 编码
        response.put("statusCode", statusCode);
        response.put("statusDescription", statusDescription); // 这一项可选

        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json; charset=utf-8");
        headers.put("Access-Control-Allow-Origin", "*"); // 允许跨域，方便本地开发调试
        headers.put("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        response.put("headers", headers);

        if (body != null) {
            response.put("body", gson.toJson(body));
        } else {
            response.put("body", "");
        }

        return response;
    }
}