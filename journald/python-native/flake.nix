{
  description = "Journald native OpenTelemetry example environment";

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
            pkgs.python312
            pkgs.opentelemetry-collector-contrib
            pkgs.nodejs_22
          ];

          shellHook = ''
            echo "Journald native OpenTelemetry example environment"
            echo "Python version: $(python3 --version)"
            echo "OTel Collector: $(otelcol-contrib --version 2>&1 | head -1)"
            echo ""

            if ! command -v journalctl &> /dev/null; then
              echo "WARNING: journalctl not found on this host."
              echo "This example requires Linux with systemd."
              echo "For a cross-platform alternative, see ../python-docker/"
              echo ""
            fi

            echo "Run:"
            echo "  ./run.sh"
          '';
        };
      });
}
