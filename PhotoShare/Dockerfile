FROM mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled-extra AS base
WORKDIR /app
EXPOSE 5000

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG TARGETARCH
ARG BUILD_CONFIGURATION=Release

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY ["PhotoShare/PhotoShare.csproj", "PhotoShare/"]
COPY ["Memtly.Core/Memtly.Core/Memtly.Core.csproj", "Memtly.Core/Memtly.Core/"]
COPY . .

RUN dotnet restore -a $TARGETARCH "./PhotoShare/PhotoShare.csproj"

WORKDIR "/src/PhotoShare"
RUN dotnet build "./PhotoShare.csproj" -a $TARGETARCH -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./PhotoShare.csproj" -a $TARGETARCH -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Chiseled-extra ships a built-in non-root user 'app' (uid 1654, gid 1654)
# and no shell - we cannot RUN groupadd / chown / mkdir. The application
# creates /app/config, /app/uploads, /app/thumbnails etc. itself at
# startup via Directory.CreateDirectory; volume mounts must be writable
# by uid 1654.
COPY --from=publish --chown=app:app /app/publish .
USER app
ENTRYPOINT ["dotnet", "PhotoShare.dll"]
# In-container HEALTHCHECK removed - chiseled has no wget/curl. Operators
# probe /healthz from outside the container (Cloudflare Tunnel origin
# check, external uptime monitor) or via a sidecar that has a shell.