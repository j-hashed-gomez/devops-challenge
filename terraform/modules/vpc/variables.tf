variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "cluster_name" {
  description = "Name of the EKS cluster (used for tagging)"
  type        = string
}
