{
  description = "Ruby OpenTelemetry example environment";

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
            ruby_3_3
            bundler
          ];

          shellHook = ''
            echo "Ruby OpenTelemetry example environment"
            echo "Ruby version: $(ruby --version)"
            echo ""
            echo "Setup:"
            echo "  bundle install"
            echo ""
            echo "Run:"
            echo "  ruby app.rb"
          '';
        };
      });
}
