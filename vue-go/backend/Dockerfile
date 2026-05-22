FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/server /server
EXPOSE 3001
ENTRYPOINT ["/server"]
