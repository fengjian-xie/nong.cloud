ARG IMAGE_REGISTRY=docker.io
FROM ${IMAGE_REGISTRY}/library/maven:3.9.16-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B package

FROM ${IMAGE_REGISTRY}/library/eclipse-temurin:21-jre
RUN useradd --system --uid 10001 xiangqiao
WORKDIR /app
COPY --from=build /workspace/target/agri-platform-1.0.0.jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-Djava.security.egd=file:/dev/urandom","-jar","/app/app.jar"]
