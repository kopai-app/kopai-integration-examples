{
  description = "Rust OpenTelemetry example environment";

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
            rustc
            cargo
            openssl
            pkg-config
          ];

          shellHook = ''
            echo "Rust OpenTelemetry example environment"
            echo "Rust version: $(rustc --version)"
            echo ""
            echo "Build:"
            echo "  cargo build --release"
            echo ""
            echo "Run:"
            echo "  cargo run --release"
          '';
        };
      });
}
