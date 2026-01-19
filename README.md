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

### Installation Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/j-hashed-gomez/devops-challenge.git
cd devops-challenge
```

#### 2. Setup Terraform Backend (Optional but Recommended)
```bash
cd terraform/backend-setup
terraform init
terraform apply -auto-approve
cd ..
```

#### 3. Deploy Infrastructure
```bash
cd infrastructure

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (region, cluster name, etc.)

# Initialize and deploy
terraform init
terraform apply -auto-approve

# Configure kubectl
aws eks update-kubeconfig --name devops-challenge-eks --region eu-west-1
```

#### 4. Install ArgoCD
```bash
cd ../..

# Install ArgoCD
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

#### 5. Deploy Cluster-Scoped Resources
```bash
# Apply cluster-scoped resources (ClusterSecretStore)
kubectl apply -f k8s/cluster/
```

#### 6. Deploy Infrastructure Applications via ArgoCD
```bash
# Deploy Traefik Ingress Controller first
kubectl apply -f argocd/applications/traefik.yaml

# Wait for Traefik to be ready
kubectl wait --for=condition=available --timeout=300s deployment/traefik -n traefik

# Deploy infrastructure applications (External Secrets, Autoscaler, Monitoring)
kubectl apply -f argocd/applications/external-secrets-operator.yaml
kubectl apply -f argocd/applications/cluster-secrets.yaml
kubectl apply -f argocd/applications/cluster-autoscaler.yaml
kubectl apply -f argocd/applications/kube-prometheus-stack.yaml
kubectl apply -f argocd/applications/loki-stack.yaml

# Wait for infrastructure to be ready
kubectl wait --for=condition=available --timeout=600s deployment/external-secrets -n external-secrets-system
```

#### 7. Deploy Application
```bash
# Deploy the tech-challenge application
kubectl apply -f argocd/applications/tech-challenge-production.yaml

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
# Grafana
kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3001:80

# Get Grafana admin password
kubectl get secret kube-prometheus-stack-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d
echo
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
kubectl get pods -n monitoring

# Verify autoscaling
kubectl get hpa -n tech-challenge
```

## 🧹 Cleanup

```bash
# Delete all ArgoCD applications
kubectl delete applications -n argocd --all

# Destroy infrastructure
cd terraform/infrastructure
terraform destroy -auto-approve

# Destroy backend (if created)
cd ../backend-setup
terraform destroy -auto-approve
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

1. **AWS Credentials**: Ensure your AWS credentials are configured with appropriate permissions for EKS, VPC, IAM, and Secrets Manager
2. **Region**: Default is `eu-west-1`, modify in `terraform.tfvars` if needed
3. **Costs**: Running this infrastructure will incur AWS costs (~$150-200/month for the full stack)
4. **Secrets**: External Secrets Operator requires AWS Secrets Manager to be properly configured
5. **DNS**: For production, configure proper DNS records for ingress endpoints

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
```

### Pods Not Starting
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
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
