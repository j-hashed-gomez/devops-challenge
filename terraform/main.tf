terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for production with S3 backend
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "tech-challenge/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "tech-challenge"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "./modules/vpc"

  cluster_name = var.cluster_name
  vpc_cidr     = var.vpc_cidr
  environment  = var.environment
}

module "eks" {
  source = "./modules/eks"

  cluster_name         = var.cluster_name
  cluster_version      = var.cluster_version
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  node_instance_types  = var.node_instance_types
  node_desired_size    = var.node_desired_size
  node_min_size        = var.node_min_size
  node_max_size        = var.node_max_size
  environment          = var.environment
}
