{
  description = ".NET OpenTelemetry example environment";

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
            pkgs.dotnet-sdk_8
          ];

          shellHook = ''
            echo ".NET OpenTelemetry example environment"
            echo ".NET version: $(dotnet --version)"
            echo ""
            echo "Setup:"
            echo "  dotnet restore"
            echo ""
            echo "Run:"
            echo "  dotnet run"
          '';
        };
      });
}
