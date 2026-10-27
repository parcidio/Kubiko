# API Beeznoo — imagem para o Render (e para o docker-compose local).
# Contexto de build: a pasta api/ (ver render.yaml e docker-compose.yml).

# ---- Build ----
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Dependências numa camada própria: só voltam a descarregar quando o pom.xml muda
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Os testes correm no CI (precisam de Docker para o Testcontainers), não no build da imagem
RUN mvn -B -q package -DskipTests && cp target/api-*.jar app.jar

# ---- Execução ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build --chown=spring:spring /app/app.jar app.jar
USER spring:spring

# O Render define PORT (10000 por omissão); em local fica 8080. application.yaml: server.port=${PORT:8080}
ENV PORT=8080
# Memória limitada no plano do Render: a JVM usa 75% do contentor e termina (o Render reinicia) se faltar memória
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# O Render usa o seu próprio health check (healthCheckPath no render.yaml); isto serve o docker-compose
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD wget -q --spider "http://localhost:${PORT}/actuator/health" || exit 1

# exec: a JVM fica como PID 1 e recebe o SIGTERM do Render (paragem graciosa)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
