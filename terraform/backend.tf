# Remote state backend configuration
#
# Prerequisites:
# 1. Run terraform in backend-setup/ directory first to create S3 bucket and DynamoDB table
# 2. Then run 'terraform init -migrate-state' to migrate local state to remote backend
#
# Benefits:
# - Shared state across team members
# - State locking prevents concurrent modifications
# - Versioning allows state recovery
# - Encrypted at rest in S3

terraform {
  backend "s3" {
    bucket         = "devops-challenge-terraform-state-jgomez"
    key            = "devops-challenge/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "devops-challenge-terraform-locks"
    encrypt        = true

    # Optional: Enable state file checksums for integrity verification
    skip_credentials_validation = false
    skip_metadata_api_check     = false
    skip_region_validation      = false
  }
}
