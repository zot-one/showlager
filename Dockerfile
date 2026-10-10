FROM alpine:3.22

ARG PB_VERSION=0.40.5
ARG TARGETARCH=amd64

RUN apk add --no-cache ca-certificates tzdata \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && unzip -q /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip

ENV TZ=Europe/Berlin
EXPOSE 8090

# pb_data, pb_public, pb_hooks, pb_migrations are mounted (see docker-compose.yml)
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", \
     "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations"]
