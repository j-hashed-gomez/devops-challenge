# ArgoCD GitOps Configuration

This directory contains ArgoCD Application and AppProject manifests for managing multi-environment deployments.

## Architecture

```
GitHub Repository (Single Source of Truth)
    ├── main branch → Production (tech-challenge namespace)
    ├── staging branch → Staging (tech-challenge-staging namespace)
    └── dev branch → Development (tech-challenge-dev namespace)
         ↓
    ArgoCD Applications (Auto-sync enabled)
         ↓
    Kubernetes Clusters
```

## Directory Structure

```
argocd/
├── projects/
│   └── tech-challenge-project.yaml  # AppProject definition
├── applications/
│   ├── tech-challenge-production.yaml
│   ├── tech-challenge-staging.yaml
│   └── tech-challenge-dev.yaml
└── README.md
```

## Prerequisites

1. ArgoCD installed in the cluster
2. GitHub repository configured
3. ArgoCD CLI installed (optional, for CLI operations)

## Installation

### Step 1: Install ArgoCD (if not already installed)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
```

### Step 2: Get ArgoCD Admin Password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo
```

### Step 3: Access ArgoCD UI

```bash
# Port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080
# Username: admin
# Password: (from step 2)
```

### Step 4: Create AppProject

```bash
kubectl apply -f argocd/projects/tech-challenge-project.yaml
```

Verify:
```bash
kubectl get appproject -n argocd
```

### Step 5: Deploy Applications

#### Production

```bash
kubectl apply -f argocd/applications/tech-challenge-production.yaml
```

#### Staging

```bash
kubectl apply -f argocd/applications/tech-challenge-staging.yaml
```

#### Development

```bash
kubectl apply -f argocd/applications/tech-challenge-dev.yaml
```

### Step 6: Verify Deployments

```bash
# Check ArgoCD applications
kubectl get application -n argocd

# Check application status
argocd app list
argocd app get tech-challenge-production
```

## Environment Configuration

### Development
- **Branch**: `dev`
- **Namespace**: `tech-challenge-dev`
- **Path**: `k8s/overlays/development`
- **Replicas**: 1 (min) to 3 (max via HPA)
- **Storage**: 5Gi MongoDB
- **Host**: dev.tech-challenge.example.com

### Staging
- **Branch**: `staging`
- **Namespace**: `tech-challenge-staging`
- **Path**: `k8s/overlays/staging`
- **Replicas**: 2 (min) to 6 (max via HPA)
- **Storage**: 8Gi MongoDB
- **Host**: staging.tech-challenge.example.com

### Production
- **Branch**: `main`
- **Namespace**: `tech-challenge`
- **Path**: `k8s/base`
- **Replicas**: 2 (min) to 10 (max via HPA)
- **Storage**: 10Gi MongoDB
- **Host**: tech-challenge.example.com

## Workflow

### 1. Development
```bash
# Make changes
git checkout dev
# Edit manifests or code
git commit -m "feat: add new feature"
git push origin dev

# ArgoCD auto-syncs to tech-challenge-dev namespace
```

### 2. Staging
```bash
# Promote to staging
git checkout staging
git merge dev
git push origin staging

# ArgoCD auto-syncs to tech-challenge-staging namespace
```

### 3. Production
```bash
# Create release tag
git checkout main
git merge staging
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main
git push origin v1.2.0

# ArgoCD auto-syncs to tech-challenge namespace
# GitHub Actions builds and tags Docker image
```

## Features

### Auto-Sync
- Automatically deploys changes from Git
- Polls repository every 3 minutes
- Can be configured for webhook-based sync

### Self-Healing
- Automatically corrects drift between Git and cluster
- Reverts manual kubectl changes
- Ensures GitOps compliance

### Pruning
- Removes resources deleted from Git
- Maintains clean state
- Uses foreground propagation for safe deletion

### Ignore Differences
- Ignores HPA-managed replicas
- Prevents sync loops
- Customizable per resource

## Operations

### Manual Sync

```bash
argocd app sync tech-challenge-production
```

### Rollback

```bash
# Via CLI
argocd app rollback tech-challenge-production <revision-id>

# Via UI
# 1. Open application
# 2. Click History
# 3. Select revision
# 4. Click Rollback
```

### Pause Auto-Sync

```bash
# Edit Application
kubectl edit application tech-challenge-production -n argocd

# Set automated to null
spec:
  syncPolicy:
    automated: null
```

### View Sync Status

```bash
argocd app get tech-challenge-production

# Or watch
argocd app wait tech-challenge-production
```

### View Logs

```bash
# Application logs
kubectl logs -n tech-challenge deployment/tech-challenge-app -f

# ArgoCD logs
kubectl logs -n argocd deployment/argocd-application-controller -f
```

## Monitoring

### Application Health

ArgoCD tracks:
- **Healthy**: All resources running as expected
- **Progressing**: Deployment in progress
- **Degraded**: Some resources failing
- **Suspended**: Application paused
- **Missing**: Resources not found

### Sync Status

- **Synced**: Git matches cluster
- **OutOfSync**: Changes in Git not yet applied
- **Unknown**: Cannot determine sync status

## Alerts

Configure ArgoCD notifications for:
- Sync failures
- Health status changes
- Deployment events

See: https://argo-cd.readthedocs.io/en/stable/operator-manual/notifications/

## Security

### RBAC

```yaml
# Example: Developer role (read-only production)
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.csv: |
    p, role:developer, applications, get, tech-challenge/*, allow
    p, role:developer, applications, sync, tech-challenge-dev/*, allow
    p, role:developer, applications, sync, tech-challenge-staging/*, allow
    g, developer-group, role:developer
```

### Secret Management

Use External Secrets Operator (see k8s/external-secrets/) instead of storing secrets in Git.

## Troubleshooting

### Application stuck in "OutOfSync"

```bash
# Hard refresh
argocd app sync tech-challenge-production --force

# Or delete and recreate
kubectl delete application tech-challenge-production -n argocd
kubectl apply -f argocd/applications/tech-challenge-production.yaml
```

### Sync failing

```bash
# Check application events
kubectl describe application tech-challenge-production -n argocd

# Check controller logs
kubectl logs -n argocd deployment/argocd-application-controller
```

### Resource not updating

Check ignoreDifferences in Application spec - it might be ignoring the field you're trying to update.

## Best Practices

1. **One Application per Environment**: Separate apps for dev/staging/prod
2. **Use AppProjects**: Organize and restrict access
3. **Enable Auto-Sync with Self-Heal**: GitOps automation
4. **Use Kustomize Overlays**: Environment-specific configuration
5. **Tag Releases**: Use semantic versioning for production
6. **Monitor Health**: Set up alerts for degraded applications
7. **Test in Dev First**: Never commit directly to main
8. **Use Protected Branches**: Require reviews for staging/prod

## Cleanup

```bash
# Delete applications
kubectl delete -f argocd/applications/

# Delete project
kubectl delete -f argocd/projects/

# Uninstall ArgoCD (optional)
kubectl delete -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl delete namespace argocd
```

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitOps Principles](https://opengitops.dev/)
- [Kustomize](https://kustomize.io/)
