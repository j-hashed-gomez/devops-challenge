# Kubernetes Manifests for Tech Challenge

This directory contains Kubernetes manifests to deploy the Tech Challenge application on EKS.

## Architecture

The application consists of two main components:

### MongoDB Database
- **StatefulSet**: Ensures stable network identity and persistent storage
- **Headless Service**: Enables direct pod-to-pod communication
- **PersistentVolumeClaim**: 10Gi gp3 EBS volume for data persistence
- **ConfigMap**: Database initialization script
- **Secret**: Database credentials (username, password, connection URI)

### NestJS Application
- **Deployment**: 2 replicas with rolling updates
- **Service**: ClusterIP service exposing port 80
- **Ingress**: AWS ALB for external access with HTTPS redirect
- **NetworkPolicy**: Restricts traffic to/from pods

## Security Features

### Pod Security
- **runAsNonRoot**: Enforced on all containers
- **readOnlyRootFilesystem**: App container filesystem is read-only
- **seccompProfile**: RuntimeDefault seccomp profile
- **capabilities**: All capabilities dropped from app container
- **Resource limits**: CPU and memory limits defined

### Network Security
- **NetworkPolicy**: Restricts ingress/egress traffic
  - App can only connect to MongoDB and DNS
  - MongoDB only accepts connections from app pods
  - No pod-to-pod communication except explicitly allowed

### Secrets Management
- Credentials stored in Kubernetes Secrets
- Environment variables injected from secrets
- **Production**: Use AWS Secrets Manager with External Secrets Operator

## Resource Allocation

### MongoDB
- **Requests**: 250m CPU, 512Mi memory
- **Limits**: 1000m CPU, 1Gi memory
- **Storage**: 10Gi gp3 EBS volume

### Application
- **Requests**: 100m CPU, 128Mi memory
- **Limits**: 500m CPU, 512Mi memory
- **Replicas**: 2 (high availability)

## Health Checks

### MongoDB
- **Liveness**: mongosh ping command every 10s
- **Readiness**: mongosh ping command every 5s

### Application
- **Liveness**: HTTP GET / every 10s
- **Readiness**: HTTP GET / every 5s

## Prerequisites

1. EKS cluster provisioned (see `terraform/` directory)
2. kubectl configured to access the cluster
3. AWS Load Balancer Controller installed in cluster

### Install AWS Load Balancer Controller

```bash
# Create IAM policy for load balancer controller
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam-policy.json

# Create service account with IAM role
eksctl create iamserviceaccount \
  --cluster=tech-challenge-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::<AWS_ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# Install controller via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tech-challenge-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

## Deployment

### 1. Update Secrets

**IMPORTANT**: Update the MongoDB credentials before deploying to production.

Edit `k8s/base/mongodb-secret.yaml`:

```yaml
stringData:
  mongodb-root-username: <your-username>
  mongodb-root-password: <strong-random-password>
  mongodb-uri: mongodb://<username>:<password>@mongodb:27017/tech_challenge?authSource=admin
```

For production, use AWS Secrets Manager:

```bash
# Store secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name tech-challenge/mongodb \
  --secret-string '{"username":"admin","password":"<strong-password>"}'

# Install External Secrets Operator (recommended for production)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace
```

### 2. Deploy with kubectl

```bash
# Deploy all resources
kubectl apply -k k8s/base/

# Verify deployment
kubectl get all -n tech-challenge
kubectl get pvc -n tech-challenge
kubectl get ingress -n tech-challenge
```

### 3. Deploy with Kustomize overlays

For environment-specific configurations:

```bash
# Production
kubectl apply -k k8s/overlays/production/

# Staging
kubectl apply -k k8s/overlays/staging/
```

### 4. Monitor Deployment

```bash
# Watch pod status
kubectl get pods -n tech-challenge -w

# Check pod logs
kubectl logs -n tech-challenge -l app=tech-challenge-app -f
kubectl logs -n tech-challenge -l app=mongodb -f

# Describe pods for issues
kubectl describe pod -n tech-challenge <pod-name>
```

### 5. Get Application URL

```bash
# Get ALB DNS name
kubectl get ingress -n tech-challenge tech-challenge-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Access the application at the returned URL (it may take 2-3 minutes for DNS to propagate).

## Scaling

### Horizontal Pod Autoscaler

Create HPA for automatic scaling based on CPU:

```bash
kubectl autoscale deployment tech-challenge-app \
  -n tech-challenge \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

### Manual Scaling

```bash
# Scale application
kubectl scale deployment tech-challenge-app -n tech-challenge --replicas=5

# MongoDB scaling requires StatefulSet coordination
kubectl scale statefulset mongodb -n tech-challenge --replicas=3
```

## Troubleshooting

### Pods not starting

```bash
# Check events
kubectl get events -n tech-challenge --sort-by='.lastTimestamp'

# Check pod status
kubectl describe pod -n tech-challenge <pod-name>

# Check logs
kubectl logs -n tech-challenge <pod-name>
```

### Database connection issues

```bash
# Verify MongoDB is running
kubectl get pods -n tech-challenge -l app=mongodb

# Test connection from app pod
kubectl exec -n tech-challenge -it <app-pod-name> -- sh
# (won't work with distroless, use debug container)

kubectl debug -n tech-challenge <app-pod-name> -it --image=busybox --target=app
nc -zv mongodb 27017
```

### Ingress not working

```bash
# Check ingress status
kubectl describe ingress -n tech-challenge tech-challenge-ingress

# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

### Network Policy blocking traffic

```bash
# Temporarily disable network policies
kubectl delete networkpolicy -n tech-challenge --all

# Re-apply after debugging
kubectl apply -k k8s/base/
```

## Cleanup

```bash
# Delete all resources
kubectl delete -k k8s/base/

# Or delete namespace (cascade delete)
kubectl delete namespace tech-challenge
```

## Production Recommendations

1. **Secrets Management**
   - Use AWS Secrets Manager with External Secrets Operator
   - Rotate credentials regularly
   - Enable encryption at rest with KMS

2. **High Availability**
   - Run MongoDB as a ReplicaSet (3 replicas minimum)
   - Use topology spread constraints for app pods
   - Deploy across multiple availability zones

3. **Monitoring**
   - Enable Prometheus metrics collection
   - Set up Grafana dashboards
   - Configure alerting for critical metrics

4. **Backup**
   - Enable automated EBS snapshots for MongoDB PVCs
   - Use MongoDB backup tools (mongodump, Percona Backup)
   - Test restore procedures regularly

5. **SSL/TLS**
   - Configure ACM certificate for ALB
   - Enable SSL between app and MongoDB
   - Enforce HTTPS only

6. **Resource Optimization**
   - Adjust resource requests/limits based on actual usage
   - Enable Vertical Pod Autoscaler for recommendations
   - Use spot instances for cost savings (non-critical workloads)

## Directory Structure

```
k8s/
├── base/
│   ├── namespace.yaml              # Namespace definition
│   ├── mongodb-secret.yaml         # MongoDB credentials
│   ├── mongodb-configmap.yaml      # MongoDB init script
│   ├── mongodb-statefulset.yaml    # MongoDB StatefulSet and Service
│   ├── app-deployment.yaml         # Application Deployment
│   ├── app-service.yaml            # Application Service
│   ├── ingress.yaml                # ALB Ingress
│   ├── network-policy.yaml         # Network policies
│   └── kustomization.yaml          # Kustomize base
├── overlays/
│   ├── production/                 # Production-specific configs
│   └── staging/                    # Staging-specific configs
└── README.md                       # This file
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Kustomize](https://kustomize.io/)
