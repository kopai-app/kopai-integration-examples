{
  description = "Python OpenTelemetry example environment";

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
            pkgs.python312Packages.pip
          ];

          shellHook = ''
            echo "Python OpenTelemetry example environment"
            echo "Python version: $(python --version)"
            echo ""
            echo "Setup:"
            echo "  python -m venv .venv"
            echo "  source .venv/bin/activate"
            echo "  pip install -r requirements.txt"
            echo ""
            echo "Run:"
            echo "  python app.py"
          '';
        };
      });
}
