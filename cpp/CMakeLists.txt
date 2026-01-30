cmake_minimum_required(VERSION 3.16)
project(cpp-otel-example)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# Fetch cpp-httplib (header-only HTTP server)
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.18.3
)
FetchContent_MakeAvailable(httplib)

# Fetch opentelemetry-cpp with OTLP HTTP support
FetchContent_Declare(
    opentelemetry-cpp
    GIT_REPOSITORY https://github.com/open-telemetry/opentelemetry-cpp.git
    GIT_TAG v1.19.0
)
# Configure opentelemetry-cpp build options
set(WITH_OTLP_HTTP ON CACHE BOOL "" FORCE)
set(WITH_OTLP_GRPC OFF CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(WITH_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WITH_BENCHMARK OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(opentelemetry-cpp)

add_executable(cpp-example src/main.cpp)

target_link_libraries(cpp-example PRIVATE
    httplib::httplib
    opentelemetry_trace
    opentelemetry_logs
    opentelemetry_metrics
    opentelemetry_exporter_otlp_http
    opentelemetry_exporter_otlp_http_log
    opentelemetry_exporter_otlp_http_metric
)

# Link pthread for threading
find_package(Threads REQUIRED)
target_link_libraries(cpp-example PRIVATE Threads::Threads)
