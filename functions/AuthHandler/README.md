# AuthHandler Java 云函数

这是一个使用 JustAuth 库的腾讯云开发 Java 云函数。

## 前置要求

1. 安装 Java 11 或更高版本
2. 安装 Maven 3.6 或更高版本

## 项目结构

```
AuthHandler/
├── pom.xml          # Maven 配置文件
├── src/
│   └── main/
│       └── java/
│           └── com/
│               └── yourcompany/
│                   └── AuthHandler.java  # 主函数入口
└── README.md        # 本文件
```

## 打包步骤

### 1. 创建标准 Maven 目录结构

如果还没有创建源代码目录，请先创建：

```bash
cd functions/AuthHandler
mkdir -p src/main/java/com/yourcompany
```

### 2. 编写 Java 代码

在 `src/main/java/com/yourcompany/AuthHandler.java` 中编写你的云函数代码。

### 3. 使用 Maven 打包

在 `functions/AuthHandler` 目录下执行：

```bash
mvn clean package
```

打包完成后，会在 `target/` 目录下生成：
- `scf-justauth-demo-1.0.0.jar` - 这是包含所有依赖的 fat jar 文件

## 部署到腾讯云开发

### 方式一：通过腾讯云控制台手动上传

1. 登录 [腾讯云开发控制台](https://console.cloud.tencent.com/tcb)
2. 进入你的环境
3. 进入"云函数" -> "函数管理"
4. 创建新函数或选择现有函数
5. 在"函数代码"中：
   - 选择"本地上传 zip 包"
   - 将 `target/scf-justauth-demo-1.0.0.jar` 打包成 zip 文件
   - 上传 zip 文件
6. 配置函数：
   - **运行环境**：Java 11
   - **执行方法**：`com.yourcompany.AuthHandler::mainHandler`（根据你的实际主类和方法名调整）
   - **超时时间**：建议 30 秒
   - **内存**：建议 512MB

### 方式二：通过 TCB CLI 部署

如果使用 TCB CLI，需要先创建 zip 文件：

```bash
# 在 functions/AuthHandler 目录下
cd target
zip -r ../AuthHandler.zip scf-justauth-demo-1.0.0.jar
cd ..

# 然后使用 TCB CLI 部署
tcb fn deploy AuthHandler -e <your-env-id>
```

## 注意事项

1. **Fat JAR 必须包含所有依赖**：使用 `maven-shade-plugin` 打包的 jar 文件已经包含了所有依赖，可以直接上传。

2. **主类配置**：确保你的 Java 类实现了腾讯云函数的入口方法：
   ```java
   public class AuthHandler {
       public Map<String, Object> mainHandler(Map<String, Object> event) {
           // event 包含请求信息：path, httpMethod, queryString, body 等
           // 返回 Map 包含：statusCode, headers, body
           // 你的代码
       }
   }
   ```
   
   注意：腾讯云开发的 Java 云函数使用标准的 `Map<String, Object>` 接口，不需要额外的 SDK 依赖。

3. **依赖版本**：
   - JustAuth: 1.16.6
   - Java: 11
   - 确保所有依赖版本兼容

4. **日志配置**：项目已配置 Logback，日志会自动输出到云函数日志中。

## 常见问题

### Q: 打包后 jar 文件太大？
A: 这是正常的，因为包含了所有依赖。JustAuth 及其依赖会使得 jar 文件较大（通常 10-20MB）。

### Q: 如何验证打包是否正确？
A: 可以使用以下命令检查 jar 文件内容：
```bash
jar -tf target/scf-justauth-demo-1.0.0.jar | head -20
```
应该能看到 JustAuth 相关的类文件。

### Q: 部署后函数无法运行？
A: 检查：
1. 运行环境是否选择 Java 11
2. 执行方法路径是否正确（格式：`包名.类名::方法名`）
3. 查看云函数日志排查错误

