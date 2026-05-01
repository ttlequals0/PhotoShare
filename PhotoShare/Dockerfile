FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
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
RUN groupadd -r --gid 10001 photoshare && \
    useradd -r -u 10001 -g photoshare -m -d /home/photoshare photoshare
COPY --from=publish --chown=photoshare:photoshare /app/publish .
RUN mkdir -p /app/config && chown -R photoshare:photoshare /app
USER photoshare
ENTRYPOINT ["dotnet", "PhotoShare.dll"]