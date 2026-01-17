# External Secrets Operator

This directory contains manifests for External Secrets Operator integration with AWS Secrets Manager.

## Architecture

```
AWS Secrets Manager → External Secrets Operator → Kubernetes Secret
                              ↓
                         IRSA (IAM Role)
```

## Prerequisites

1. EKS cluster with OIDC provider configured
2. Helm 3 installed
3. AWS CLI configured
4. kubectl configured

## Installation

### Step 1: Install External Secrets Operator via Helm

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace \
  --set installCRDs=true
```

### Step 2: Create IAM Policy

```bash
aws iam create-policy \
  --policy-name ExternalSecretsPolicy \
  --policy-document file://k8s/external-secrets/iam-policy.json
```

Note the ARN returned (you'll need it in the next step).

### Step 3: Create IRSA (IAM Role for Service Account)

```bash
# Replace <ACCOUNT_ID> with your AWS account ID
eksctl create iamserviceaccount \
  --cluster=tech-challenge-cluster \
  --namespace=external-secrets-system \
  --name=external-secrets \
  --attach-policy-arn=arn:aws:iam::<ACCOUNT_ID>:policy/ExternalSecretsPolicy \
  --override-existing-serviceaccounts \
  --approve
```

### Step 4: Create Secret in AWS Secrets Manager

```bash
# Create MongoDB credentials secret
aws secretsmanager create-secret \
  --name tech-challenge/mongodb \
  --description "MongoDB credentials for tech-challenge application" \
  --secret-string '{
    "username": "admin",
    "password": "your-strong-password-here"
  }' \
  --region us-east-1
```

### Step 5: Apply ClusterSecretStore

```bash
kubectl apply -f k8s/external-secrets/cluster-secretstore.yaml
```

Verify:
```bash
kubectl get clustersecretstore
```

### Step 6: Apply ExternalSecret for MongoDB

```bash
kubectl apply -f k8s/external-secrets/mongodb-externalsecret.yaml
```

Verify:
```bash
# Check ExternalSecret status
kubectl get externalsecret -n tech-challenge
kubectl describe externalsecret mongodb-credentials -n tech-challenge

# Check that Kubernetes Secret was created
kubectl get secret mongodb-secret -n tech-challenge
```

## How It Works

1. **ClusterSecretStore** defines how to connect to AWS Secrets Manager using IRSA
2. **ExternalSecret** specifies which secret to fetch and how to map it to a Kubernetes Secret
3. External Secrets Operator watches ExternalSecret resources
4. Operator fetches secrets from AWS Secrets Manager every 1 hour (refreshInterval)
5. Operator creates/updates Kubernetes Secret automatically
6. Application pods consume the Kubernetes Secret as before

## Secret Rotation

Secrets are automatically refreshed every 1 hour. To trigger immediate refresh:

```bash
kubectl annotate externalsecret mongodb-credentials \
  -n tech-challenge \
  force-sync=$(date +%s) \
  --overwrite
```

## Environments

For multiple environments (dev, staging, prod), create separate secrets in AWS:

```bash
# Development
aws secretsmanager create-secret \
  --name tech-challenge/dev/mongodb \
  --secret-string '{"username":"admin","password":"dev-password"}'

# Staging
aws secretsmanager create-secret \
  --name tech-challenge/staging/mongodb \
  --secret-string '{"username":"admin","password":"staging-password"}'

# Production
aws secretsmanager create-secret \
  --name tech-challenge/prod/mongodb \
  --secret-string '{"username":"admin","password":"prod-password"}'
```

Then create environment-specific ExternalSecrets that reference the appropriate AWS secret path.

## Troubleshooting

### ExternalSecret shows "SecretSyncedError"

```bash
# Check ExternalSecret events
kubectl describe externalsecret mongodb-credentials -n tech-challenge

# Check operator logs
kubectl logs -n external-secrets-system deployment/external-secrets
```

Common issues:
- IAM policy missing permissions
- Secret doesn't exist in AWS Secrets Manager
- IRSA not configured correctly
- Wrong region in ClusterSecretStore

### Secret not updating after change in AWS

```bash
# Force sync
kubectl annotate externalsecret mongodb-credentials \
  -n tech-challenge \
  force-sync=$(date +%s) \
  --overwrite

# Or delete and recreate the ExternalSecret
kubectl delete externalsecret mongodb-credentials -n tech-challenge
kubectl apply -f k8s/external-secrets/mongodb-externalsecret.yaml
```

## Security Best Practices

1. **Use least privilege IAM policies**: Only grant access to specific secret ARNs
2. **Enable secret encryption**: AWS Secrets Manager encrypts at rest by default
3. **Audit access**: Enable CloudTrail logging for Secrets Manager
4. **Rotate secrets regularly**: Use AWS Secrets Manager rotation features
5. **Use different secrets per environment**: Never share credentials across environments

## Cost

AWS Secrets Manager pricing (us-east-1):
- $0.40 per secret per month
- $0.05 per 10,000 API calls

For this setup:
- 1 secret = $0.40/month
- API calls (refresh every 1h) = ~720 calls/month = $0.00 (within free tier)

**Total**: ~$0.40/month per secret

## Uninstall

```bash
# Remove ExternalSecret
kubectl delete -f k8s/external-secrets/mongodb-externalsecret.yaml

# Remove ClusterSecretStore
kubectl delete -f k8s/external-secrets/cluster-secretstore.yaml

# Uninstall operator
helm uninstall external-secrets -n external-secrets-system

# Delete namespace
kubectl delete namespace external-secrets-system

# Delete IAM resources (optional)
aws iam delete-policy --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/ExternalSecretsPolicy
```
