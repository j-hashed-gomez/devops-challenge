# DevOps Challenge - Production-Ready Kubernetes Deployment

A comprehensive DevOps implementation showcasing a production-ready NestJS application deployed on Amazon EKS with GitOps principles using ArgoCD.

## 📋 Overview

This project demonstrates a complete infrastructure-as-code solution featuring:

- **Application**: NestJS service that logs browser information to MongoDB
- **Infrastructure**: Production-grade AWS EKS cluster with multi-AZ deployment
- **GitOps**: ArgoCD for declarative application management
- **Observability**: Prometheus, Grafana, and Loki for comprehensive monitoring
- **Security**: AWS Secrets Manager integration via External Secrets Operator
- **Scalability**: Horizontal Pod Autoscaler and Cluster Autoscaler

## 🏗️ Architecture

The solution implements a multi-layered architecture:

- **Compute**: Amazon EKS 1.33 with managed node groups
- **Networking**: VPC with public/private subnets across 3 availability zones
- **Storage**: MongoDB for application data persistence
- **Monitoring**: Prometheus + Grafana for metrics, Loki for logs
- **Secrets Management**: External Secrets Operator with AWS Secrets Manager
- **Auto-scaling**: HPA for pods, Cluster Autoscaler for nodes

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured with appropriate credentials
- kubectl installed
- Terraform >= 1.6.0
- Helm 3.x
- Git

### Incorporating Corrections to dev and main (Optional)

If you want to incorporate the production-ready corrections from the `feature/corrections` branch into `dev` and `main` branches:

```bash
# 1. Update feature/corrections branch
git checkout feature/corrections
git pull origin feature/corrections

# 2. Merge to dev branch
git checkout dev
git pull origin dev
git merge feature/corrections
git push origin dev

# 3. Merge to main branch
git checkout main
git pull origin main
git merge feature/corrections
git push origin main

# 4. Optional: Clean up feature branch after merge
git branch -d feature/corrections
git push origin --delete feature/corrections
```

**Alternative - Using a script:**

Create a file `merge-corrections.sh`:
```bash
#!/bin/bash
echo "Merging feature/corrections to dev and main..."

git checkout feature/corrections && git pull origin feature/corrections
git checkout dev && git pull origin dev && git merge feature/corrections && git push origin dev
git checkout main && git pull origin main && git merge feature/corrections && git push origin main

echo "Cleaning up feature branch..."
git branch -d feature/corrections
git push origin --delete feature/corrections

echo "Done! Merged to both dev and main."
git checkout main
```

Then execute:
```bash
chmod +x merge-corrections.sh
./merge-corrections.sh
```

### Installation Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/j-hashed-gomez/devops-challenge.git
cd devops-challenge
```

#### 2. Setup Terraform Backend (Optional but Recommended)
```bash
cd terraform/backend-setup

# Initialize and deploy backend (S3 + DynamoDB for state locking)
terraform init
AWS_PROFILE=personal-aws terraform apply -auto-approve

cd ..
```

#### 3. Deploy Infrastructure
```bash
cd infrastructure

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your AWS profile and desired configuration

# Initialize and deploy infrastructure
terraform init
AWS_PROFILE=personal-aws terraform apply -auto-approve

# Configure kubectl to access the cluster
AWS_PROFILE=personal-aws aws eks update-kubeconfig --name devops-challenge-eks --region eu-west-1

cd ../..
```

#### 4. Install ArgoCD
```bash
# Install ArgoCD in the cluster
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo

# Port-forward to access ArgoCD UI (optional)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
```

#### 5. Deploy Infrastructure Applications via ArgoCD
```bash
# Deploy cluster-scoped resources first (StorageClass gp3)
kubectl apply -f k8s/cluster/storageclass-gp3.yaml

# Deploy Traefik Ingress Controller
kubectl apply -f argocd/applications/traefik.yaml

# Wait for Traefik to be ready
kubectl wait --for=condition=available --timeout=300s deployment/traefik -n traefik

# Deploy External Secrets Operator
kubectl apply -f argocd/applications/external-secrets-operator.yaml

# Wait for External Secrets to be ready
kubectl wait --for=condition=available --timeout=600s deployment/external-secrets -n external-secrets

# Deploy cluster-scoped resources (ClusterSecretStore - requires External Secrets)
kubectl apply -f k8s/cluster/cluster-secretstore.yaml

# Deploy remaining infrastructure applications
kubectl apply -f argocd/applications/cluster-secrets.yaml
kubectl apply -f argocd/applications/cluster-autoscaler.yaml
kubectl apply -f argocd/applications/kube-prometheus-stack.yaml
kubectl apply -f argocd/applications/loki-stack.yaml

# Wait for observability namespace to be created by kube-prometheus-stack
kubectl wait --for=jsonpath='{.status.phase}'=Active --timeout=60s namespace/observability

# Deploy Grafana credentials from AWS Secrets Manager
kubectl apply -f k8s/observability/grafana/external-secret.yaml

# Wait for Grafana secret to be synced
kubectl wait --for=condition=Ready --timeout=60s externalsecret/grafana-admin-credentials -n observability
```

#### 6. Create ArgoCD Project for Applications
```bash
# Create the tech-challenge project in ArgoCD
kubectl apply -f argocd/projects/tech-challenge-project.yaml
```

#### 7. Deploy Application
```bash
# Deploy the tech-challenge application
kubectl apply -f argocd/applications/tech-challenge-production.yaml

# Wait for application to be healthy
sleep 30

# Verify deployment
kubectl get applications -n argocd
kubectl get pods -n tech-challenge
```

#### 8. Access the Application
```bash
# Get the Traefik LoadBalancer URL (AWS NLB)
kubectl get svc traefik -n traefik

# Access the application via the LoadBalancer
# The LoadBalancer will route traffic to the application based on Ingress rules

# Or port-forward for local access
kubectl port-forward svc/tech-challenge-app -n tech-challenge 3000:80
```

#### 9. Access Monitoring (Optional)
```bash
# Grafana - Port forward to access UI
kubectl port-forward svc/kube-prometheus-stack-grafana -n observability 3001:80

# Open browser and navigate to http://localhost:3001
# Login with username 'admin' and the password from the command below

# Get Grafana admin password (auto-generated by AWS Secrets Manager)
kubectl get secret grafana-admin-secret -n observability -o jsonpath="{.data.admin-password}" | base64 -d
echo

# Alternative: Get password directly from AWS Secrets Manager
AWS_PROFILE=personal-aws aws secretsmanager get-secret-value \
  --secret-id observability/grafana/credentials \
  --query 'SecretString' \
  --output text | jq -r '.password'
```

**Note**: If pods remain in `Pending` state due to insufficient node capacity, the cluster autoscaler will automatically scale up the node group. You can verify this with:
```bash
kubectl get nodes
kubectl describe pod <pending-pod-name> -n <namespace>
```

## 🔍 Quick Verification Commands

```bash
# Check cluster status
kubectl get nodes

# Check all ArgoCD applications
kubectl get applications -n argocd

# Check Traefik ingress controller
kubectl get pods -n traefik
kubectl get svc traefik -n traefik

# Check application pods
kubectl get pods -n tech-challenge

# Check ingress resources
kubectl get ingress -n tech-challenge

# Check monitoring stack
kubectl get pods -n observability

# Verify autoscaling
kubectl get hpa -n tech-challenge
```

## 🧹 Cleanup

```bash
# Delete all ArgoCD applications
kubectl delete applications -n argocd --all

# Destroy infrastructure
# Replace 'your-aws-profile' with your AWS CLI profile name
cd terraform/infrastructure
AWS_PROFILE=your-aws-profile terraform destroy -auto-approve

# Destroy backend (if created)
cd ../backend-setup
AWS_PROFILE=your-aws-profile terraform destroy -auto-approve
```

## 🔄 CI/CD Pipeline

The project includes automated CI/CD pipelines using GitHub Actions. The pipeline triggers on:
- Pushes to the `dev` branch
- Version tags following semantic versioning (e.g., `v1.0.0`)

### Triggering a Deployment

#### Option 1: Push to Dev Branch
```bash
# Make your changes
git add .
git commit -m "feat: your feature description"
git push origin dev
```

#### Option 2: Create and Push a Version Tag
```bash
# Create a new tag (replace with your version)
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag to trigger CI/CD
git push origin v1.0.0
```

#### Option 3: Manual Workflow Dispatch
Navigate to GitHub Actions in your repository and manually trigger the workflow with custom parameters.

### What the Pipeline Does

1. **Code Quality Checks**
   - Linting (ESLint)
   - Unit tests
   - Integration tests
   - Security scanning (Trivy)

2. **Build & Push**
   - Builds Docker image
   - Scans for vulnerabilities
   - Pushes to GitHub Container Registry

3. **Deploy**
   - Updates image tag in Kubernetes manifests
   - ArgoCD automatically syncs changes to the cluster

### Monitoring the Pipeline

```bash
# Check pipeline status
gh run list

# View logs for a specific run
gh run view <run-id> --log

# Watch CI/CD in real-time
gh run watch
```

## 📖 Documentation

For detailed information about the implementation, architecture decisions, and deployment process, see:

- [**CHALLENGE_REPORT.md**](./CHALLENGE_REPORT.md) - Comprehensive technical report
- [**README.dev.md**](./README.dev.md) - Local development guide
- [**README.cicd.md**](./README.cicd.md) - CI/CD pipeline documentation

## ⚠️ Important Notes

1. **AWS Credentials**: Ensure your AWS credentials are configured with appropriate permissions for EKS, VPC, IAM, and Secrets Manager. Configure your AWS profile in `terraform.tfvars` with the variable `aws_profile`
2. **Region**: Default is `eu-west-1`, modify in `terraform.tfvars` if needed
3. **Costs**: Running this infrastructure will incur AWS costs (~$150-200/month for the full stack)
4. **Secrets**: MongoDB and Grafana credentials are automatically created in AWS Secrets Manager during Terraform deployment. The External Secrets Operator syncs these secrets to Kubernetes
5. **DNS**: For production, configure proper DNS records for ingress endpoints
6. **Node Capacity**: t3.medium instances support up to 17 pods per node. The cluster autoscaler will automatically scale the node group when capacity is reached
7. **Installation Order**: Follow the steps in order, especially deploying External Secrets Operator before ClusterSecretStore

## 🛠️ Technologies Used

### Infrastructure
- **AWS EKS** - Kubernetes orchestration
- **Terraform** - Infrastructure as Code
- **ArgoCD** - GitOps continuous delivery

### Observability
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Loki** - Log aggregation

### Security
- **External Secrets Operator** - Secret management
- **AWS Secrets Manager** - Secret storage
- **IAM Roles for Service Accounts (IRSA)** - Pod-level AWS permissions

### Application
- **NestJS** - Node.js framework
- **MongoDB** - NoSQL database
- **TypeScript** - Application language

## 🐛 Troubleshooting

### ArgoCD Applications Stuck in Sync
```bash
kubectl get applications -n argocd
kubectl describe application <app-name> -n argocd

# Manually sync an application
kubectl patch application <app-name> -n argocd --type merge -p '{"operation":{"initiatedBy":{"username":"admin"},"sync":{"revision":"HEAD"}}}'
```

### Pods Not Starting
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>

# Check if pods are pending due to resource constraints
kubectl get pods --all-namespaces --field-selector status.phase=Pending
```

### ClusterSecretStore CRD Not Found
If you see an error about `ClusterSecretStore` CRD not found, ensure External Secrets Operator is deployed and running:
```bash
kubectl get pods -n external-secrets
kubectl wait --for=condition=available --timeout=600s deployment/external-secrets -n external-secrets
```

### Insufficient Node Capacity
If pods remain in `Pending` state with "Too many pods" error:
```bash
# Check node capacity
kubectl describe nodes | grep -A 5 "Allocatable"

# Verify cluster autoscaler is running
kubectl get pods -n kube-system | grep cluster-autoscaler

# Check autoscaler logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-cluster-autoscaler --tail=50
```

### Terraform State Lock
```bash
terraform force-unlock <lock-id>
```

## 📄 License

This project is provided as-is for demonstration and educational purposes.

## 👤 Author

José Gómez
- GitHub: [@j-hashed-gomez](https://github.com/j-hashed-gomez)
