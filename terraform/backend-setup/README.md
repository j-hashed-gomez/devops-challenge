# Terraform Backend Setup

This directory creates the remote state backend infrastructure for Terraform:
- **S3 bucket**: Store Terraform state files
- **DynamoDB table**: Prevent concurrent modifications via state locking

## Quick Start

### Step 1: Create Backend Resources (one-time setup)

```bash
cd terraform/backend-setup/

export AWS_PROFILE=personal-aws
tfenv install
terraform init
terraform apply
```

### Step 2: Migrate State to Remote Backend

```bash
cd ../  # Back to terraform/ directory
terraform init -migrate-state
# Answer: yes
```

### Step 3: Verify

```bash
aws s3 ls s3://devops-challenge-terraform-state-jgomez/devops-challenge/
aws dynamodb describe-table --table-name devops-challenge-terraform-locks
```

## Resources Created

- **S3 Bucket**: `devops-challenge-terraform-state-jgomez`
  - Versioning enabled (90-day retention)
  - AES256 encryption
  - Public access blocked

- **DynamoDB Table**: `devops-challenge-terraform-locks`
  - Pay-per-request billing
  - Encryption enabled
  - Point-in-time recovery

## Troubleshooting

**State lock error:**
```bash
terraform force-unlock <LOCK_ID>
```

**Backend config changed:**
```bash
terraform init -reconfigure
```

For detailed documentation, see CHALLENGE_REPORT.md
