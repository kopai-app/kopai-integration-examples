{
  description = "PHP OpenTelemetry example environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        php = pkgs.php83.withExtensions ({ enabled, all }: enabled ++ [
          all.curl
        ]);
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            php
            php.packages.composer
          ];

          shellHook = ''
            echo "PHP OpenTelemetry example environment"
            echo "PHP version: $(php --version | head -1)"
            echo ""
            echo "Setup:"
            echo "  composer install"
            echo ""
            echo "Run:"
            echo "  php -S 0.0.0.0:3001"
          '';
        };
      });
}
