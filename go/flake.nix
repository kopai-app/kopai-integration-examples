{
  description = "Go OpenTelemetry example environment";

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
          packages = [
            pkgs.go_1_22
          ];

          shellHook = ''
            echo "Go OpenTelemetry example environment"
            echo "Go version: $(go version)"
            echo ""
            echo "Setup:"
            echo "  go mod tidy"
            echo ""
            echo "Run:"
            echo "  go run main.go"
          '';
        };
      });
}
