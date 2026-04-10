{
  description = "LangChain OpenTelemetry example environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          venvDir = "./.venv";

          buildInputs = [
            pkgs.python312
            pkgs.python312Packages.venvShellHook
          ];

          postVenvCreation = ''
            unset SOURCE_DATE_EPOCH
            pip install -r requirements.txt
          '';

          postShellHook = ''
            unset SOURCE_DATE_EPOCH
            echo ""
            echo "LangChain OpenTelemetry example environment"
            echo "Python version: $(python --version)"
            echo ""
            echo "Run:"
            echo "  python app.py"
            echo "  Type 'exit' to quit."
          '';
        };
      });
}
