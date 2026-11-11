# API Beeznoo — imagem para o Render (e para o docker-compose local).
# Contexto de build: a pasta api/ (ver docs/DEPLOY.md e docker-compose.yml).

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
# Contentor de 512 MB no Render (Free e Starter). O heap é só uma parte: medido com Native Memory Tracking, a API
# usa ~200 MB FORA dele (metaspace ~95, symbols ~42, código compilado, threads). Com MaxRAMPercentage=75 a soma
# passava os 512 MB e o Render matava o contentor ("exceeded its memory limit") sem OutOfMemoryError nos logs.
# Medido em local com --memory=512m e 6 uploads simultâneos de fotos de 35 MP: antes OOMKilled; com isto
# 372–398 MB em repouso e pico de ~420 MB (ver claude/decisoes-produto.md, 2026-11-11).
#   heap 40% (~205 MB) · metaspace ≤ 128 MB · código ≤ 32 MB · só o compilador C1 (−60 MB, arranque mais rápido)
#   SerialGC (menos memória própria que o G1) · pilhas de 512 KB
# Atingir um teto termina a JVM com OutOfMemoryError (fica nos logs) e o Render reinicia.
# Plano com mais memória (Standard, 2 GB): subir MaxRAMPercentage e tirar TieredStopAtLevel.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=40 -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=32m -XX:TieredStopAtLevel=1 -XX:MaxDirectMemorySize=32m -Xss512k -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# O Render usa o seu próprio health check (Health Check Path no painel); isto serve o docker-compose
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD wget -q --spider "http://localhost:${PORT}/actuator/health" || exit 1

# exec: a JVM fica como PID 1 e recebe o SIGTERM do Render (paragem graciosa)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
