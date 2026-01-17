# Terraform Infrastructure

This directory contains Terraform configuration for provisioning AWS infrastructure for the Tech Challenge application.

## Architecture

- **VPC Module**: Creates VPC with 3 public and 3 private subnets across 3 AZs
- **EKS Module**: Provisions EKS cluster with managed node group

## Prerequisites

- Terraform >= 1.6.0
- AWS CLI configured with appropriate credentials
- AWS account with permissions to create VPC, EKS, IAM resources

## Usage

### Initialize Terraform

```bash
cd terraform
terraform init
```

### Plan Infrastructure

```bash
terraform plan
```

### Apply Infrastructure

```bash
terraform apply
```

This will create:
- VPC (10.0.0.0/16)
- 3 Public subnets
- 3 Private subnets
- 3 NAT Gateways
- Internet Gateway
- EKS Cluster (Kubernetes 1.33)
- Managed Node Group (m5.large instances, 1-4 nodes)
- IAM roles and policies
- Security groups
- OIDC provider for IRSA

### Configure kubectl

After Terraform completes, configure kubectl:

```bash
aws eks update-kubeconfig --region us-east-1 --name tech-challenge-cluster
```

### Verify

```bash
kubectl get nodes
```

## Customization

Edit `variables.tf` or create a `terraform.tfvars` file:

```hcl
aws_region          = "us-east-1"
cluster_name        = "tech-challenge-cluster"
cluster_version     = "1.33"
node_instance_types = ["m5.large"]
node_desired_size   = 2
node_min_size       = 1
node_max_size       = 4
```

## Cost Estimation

Monthly costs (us-east-1):
- EKS cluster: ~$73/month
- 2 x m5.large nodes (24/7): ~$140/month
- 3 x NAT Gateways: ~$97/month
- **Total**: ~$310/month

## State Management

For production, enable S3 backend in `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "tech-challenge/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

## Destroy

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all resources including data. Ensure backups exist.
