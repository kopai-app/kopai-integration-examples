{
  description = "Elixir OpenTelemetry example environment";

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
            elixir
            erlang
          ];

          shellHook = ''
            echo "Elixir OpenTelemetry example environment"
            echo "Elixir version: $(elixir --version | head -1)"
            echo ""
            echo "Setup:"
            echo "  mix deps.get"
            echo ""
            echo "Run:"
            echo "  mix run --no-halt"
          '';
        };
      });
}
