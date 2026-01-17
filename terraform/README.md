# Terraform Infrastructure for Tech Challenge

This directory contains Terraform configurations to provision an AWS EKS (Elastic Kubernetes Service) cluster with all necessary networking infrastructure.

## Architecture

The infrastructure is organized into modular components:

### VPC Module
- VPC with DNS support enabled
- 3 public subnets (one per AZ) for load balancers and NAT gateways
- 3 private subnets (one per AZ) for EKS worker nodes
- Internet Gateway for public internet access
- 3 NAT Gateways (one per AZ) for high availability
- Route tables for public and private subnets
- Proper tagging for Kubernetes integration

### EKS Module
- EKS cluster with Kubernetes 1.31
- Control plane with API, audit, and controller manager logging enabled
- OIDC provider for IRSA (IAM Roles for Service Accounts)
- Managed node group with auto-scaling (1-4 nodes)
- Security groups for cluster and nodes
- IMDSv2 enforcement on worker nodes
- Encrypted EBS volumes for worker nodes

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.6.0 installed
3. IAM permissions to create VPC, EKS, EC2, and IAM resources

## AWS Permissions Required

The IAM user or role running Terraform needs the following permissions:
- EC2 (VPC, Subnets, Security Groups, Route Tables, NAT Gateways)
- EKS (Cluster and Node Group management)
- IAM (Roles and Policies for EKS)
- CloudWatch (Logs for EKS)

## Usage

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Configure Variables

Copy the example variables file and customize:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your desired values:

```hcl
aws_region      = "us-east-1"
cluster_name    = "tech-challenge-cluster"
cluster_version = "1.31"

node_instance_types = ["t3.medium"]
node_desired_size   = 2
node_min_size       = 1
node_max_size       = 4
```

### 3. Review the Plan

```bash
terraform plan
```

Review the proposed changes carefully. The plan will create:
- 1 VPC
- 6 subnets (3 public, 3 private)
- 1 Internet Gateway
- 3 NAT Gateways
- 3 Elastic IPs
- Route tables and associations
- 1 EKS cluster
- 1 managed node group
- IAM roles and policies
- Security groups

### 4. Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted. The provisioning process takes approximately 15-20 minutes.

### 5. Configure kubectl

After successful deployment, configure kubectl to interact with the cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name tech-challenge-cluster
```

Verify connectivity:

```bash
kubectl get nodes
kubectl get pods -A
```

## Outputs

After successful deployment, Terraform provides the following outputs:

- `cluster_name` - Name of the EKS cluster
- `cluster_endpoint` - API server endpoint
- `configure_kubectl` - Command to configure kubectl
- `vpc_id` - VPC ID
- `private_subnet_ids` - Private subnet IDs
- `public_subnet_ids` - Public subnet IDs

View outputs:

```bash
terraform output
```

## Cost Estimation

Estimated monthly costs (us-east-1):

- EKS cluster: ~$73/month
- 2 x t3.medium nodes (24/7): ~$60/month
- 3 x NAT Gateways: ~$97/month
- Data transfer: varies

**Total: ~$230/month**

To reduce costs:
- Use a single NAT Gateway instead of 3 (reduces HA)
- Use smaller instance types (t3.small)
- Enable cluster autoscaling to scale to zero during off-hours

## Security Features

### Network Security
- Private subnets for worker nodes (no direct internet access)
- Public subnets isolated for load balancers only
- Security groups with least privilege rules
- NAT Gateways for outbound internet access from private subnets

### Cluster Security
- OIDC provider for IRSA (no static credentials needed)
- Control plane logging enabled
- Private endpoint access enabled
- IMDSv2 enforcement on worker nodes
- Encrypted EBS volumes

### IAM Security
- Separate IAM roles for cluster and nodes
- Managed policies with least privilege
- IRSA support for pod-level permissions

## State Management

For production use, enable remote state management with S3 and DynamoDB:

1. Create an S3 bucket for state storage:
```bash
aws s3 mb s3://your-terraform-state-bucket
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled
```

2. Create a DynamoDB table for state locking:
```bash
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

3. Uncomment and configure the backend in `versions.tf`:
```hcl
backend "s3" {
  bucket         = "your-terraform-state-bucket"
  key            = "tech-challenge/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

4. Initialize the backend:
```bash
terraform init -migrate-state
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

Type `yes` when prompted. This will delete all resources created by Terraform.

**Warning**: This action is irreversible. Ensure you have backups of any data before destroying.

## Module Structure

```
terraform/
├── main.tf                  # Root module configuration
├── variables.tf             # Root module variables
├── outputs.tf               # Root module outputs
├── versions.tf              # Provider and version constraints
├── terraform.tfvars.example # Example variable values
├── .gitignore               # Terraform-specific gitignore
├── modules/
│   ├── vpc/
│   │   ├── main.tf         # VPC resources
│   │   ├── variables.tf    # VPC variables
│   │   └── outputs.tf      # VPC outputs
│   └── eks/
│       ├── main.tf         # EKS cluster and node group
│       ├── variables.tf    # EKS variables
│       └── outputs.tf      # EKS outputs
└── README.md               # This file
```

## Troubleshooting

### Insufficient Permissions
If you encounter permission errors, ensure your IAM user/role has the required permissions listed above.

### Node Group Fails to Create
- Check that your AWS account has sufficient EC2 capacity in the selected region
- Verify that the instance type is available in all selected availability zones

### kubectl Connection Issues
- Ensure AWS CLI is configured with the same credentials used for Terraform
- Verify that the cluster endpoint is accessible from your network
- Check that the cluster security group allows your IP

## Next Steps

After the infrastructure is provisioned:

1. Deploy the application using Kubernetes manifests (see `k8s/` directory)
2. Configure monitoring and observability
3. Set up automated backups for persistent data
4. Implement GitOps with ArgoCD or Flux

## References

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [EKS Workshop](https://www.eksworkshop.com/)
