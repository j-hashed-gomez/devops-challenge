# Kubernetes Manifests

This directory contains Kubernetes manifests for deploying the Tech Challenge application.

## Structure

```
k8s/
├── base/                    # Base manifests for all environments
│   ├── namespace.yaml
│   ├── mongodb-*.yaml       # MongoDB StatefulSet, Service, ConfigMap, Secret
│   ├── app-*.yaml           # Application Deployment, Service, HPA
│   ├── ingress.yaml
│   ├── network-policy.yaml
│   ├── poddisruptionbudget.yaml
│   ├── resourcequota.yaml
│   └── kustomization.yaml
├── overlays/                # Environment-specific overlays
│   ├── production/
│   └── staging/
└── observability/           # Monitoring and logging
    ├── kube-prometheus-stack-values.yaml
    ├── loki/
    └── elk/
```

## Prerequisites

- EKS cluster running (from Terraform)
- kubectl configured
- Helm 3 installed

## Deployment

### 1. Deploy Application

```bash
kubectl apply -k k8s/base/
```

This deploys:
- Namespace: tech-challenge
- MongoDB StatefulSet with 10Gi persistent storage
- Application Deployment with 2-10 replicas (HPA)
- Services (ClusterIP and Headless)
- Ingress (Traefik)
- NetworkPolicy (zero-trust)
- PodDisruptionBudgets
- ResourceQuota and LimitRange

### 2. Verify Deployment

```bash
kubectl get all -n tech-challenge
kubectl get pvc -n tech-challenge
kubectl get hpa -n tech-challenge
```

### 3. Access Application

```bash
# Port-forward for testing
kubectl port-forward -n tech-challenge svc/tech-challenge-app 8080:80

# Open http://localhost:8080
```

## Components

### MongoDB
- **StatefulSet**: 1 replica with persistent storage
- **Storage**: 10Gi gp3 EBS volume
- **Security**: Non-root user, read-only filesystem where possible
- **Backup**: Daily automated backups via VolumeSnapshots

### Application
- **Deployment**: 2-10 replicas (HPA managed)
- **Autoscaling**: CPU-based at 70% threshold
- **Security**: Distroless image, non-root, read-only filesystem
- **Health**: Liveness and readiness probes

### Networking
- **NetworkPolicy**: Zero-trust, explicit allow only
- **Ingress**: Traefik with HTTP→HTTPS redirect
- **Service**: ClusterIP for internal communication

### Governance
- **ResourceQuota**: 4 CPU, 8Gi memory limit
- **LimitRange**: Default resource limits
- **PodDisruptionBudget**: Ensures availability during disruptions

## Observability

See [observability/README.md](observability/README.md) for monitoring setup.

## Secrets Management

For production, use External Secrets Operator with AWS Secrets Manager:

```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name tech-challenge/mongodb \
  --secret-string '{"username":"admin","password":"<strong-password>"}'

# Deploy External Secrets Operator
# See CHALLENGE_REPORT.md Step 6
```

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n tech-challenge
kubectl logs <pod-name> -n tech-challenge
```

### MongoDB connection issues

```bash
# Check MongoDB is ready
kubectl exec -it mongodb-0 -n tech-challenge -- mongosh --eval "db.adminCommand('ping')"

# Check secrets
kubectl get secret mongodb-secret -n tech-challenge -o yaml
```

### HPA not scaling

```bash
# Check metrics server
kubectl top nodes
kubectl top pods -n tech-challenge

# Check HPA status
kubectl describe hpa tech-challenge-app-hpa -n tech-challenge
```

## Cleanup

```bash
kubectl delete -k k8s/base/
```
