terraform {
  backend "s3" {
    # Backend configuration provided via terraform init -backend-config=backend.hcl
    # Never commit credentials to version control
  }
}
