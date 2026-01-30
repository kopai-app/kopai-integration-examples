{
  description = "C++ OpenTelemetry example environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Build tools
            gcc
            cmake
            ninja
            pkg-config
            git

            # OpenTelemetry SDK dependencies
            protobuf
            curl
            abseil-cpp
            nlohmann_json
          ];

          shellHook = ''
            echo "C++ OpenTelemetry SDK example environment"
            echo "GCC version: $(gcc --version | head -1)"
            echo "CMake version: $(cmake --version | head -1)"
            echo ""
            echo "Build (first time ~5-10 min for OpenTelemetry SDK):"
            echo "  cmake -B build"
            echo "  cmake --build build"
            echo ""
            echo "Run:"
            echo "  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 ./build/cpp-example"
          '';
        };
      });
}
