# ELK Stack for Centralized Logging

This directory contains the configuration for the ELK (Elasticsearch, Logstash, Kibana) stack to provide centralized logging for the Tech Challenge application.

## Architecture

The logging stack consists of:

### Elasticsearch
- **Log Storage**: Stores all application and system logs
- **Search Engine**: Full-text search capabilities
- **Indexing**: Daily indices per namespace (logstash-tech-challenge-YYYY.MM.DD)
- **Storage**: 30Gi persistent volume (gp3)
- **Resources**: 500m-1000m CPU, 1-2Gi memory

### Logstash
- **Log Processing**: Parses and transforms logs
- **Pipeline**: Receives from Filebeat, outputs to Elasticsearch
- **Filtering**: JSON parsing, timestamp normalization, Kubernetes metadata
- **Storage**: 5Gi persistent queue
- **Resources**: 200m-500m CPU, 512Mi-1Gi memory

### Kibana
- **Visualization**: Web UI for log exploration
- **Dashboards**: Pre-built and custom dashboards
- **Discover**: Real-time log search
- **Port**: 5601

### Filebeat
- **Log Collection**: DaemonSet running on all nodes
- **Container Logs**: Collects from /var/log/containers/*.log
- **Kubernetes Metadata**: Enriches logs with pod, namespace, labels
- **Filtering**: Excludes kube-system and kube-public namespaces
- **Resources**: 100m-200m CPU, 128Mi-256Mi memory per node

## Log Flow

```
Container Logs → Filebeat (DaemonSet) → Logstash → Elasticsearch ← Kibana (UI)
                    ↓
              K8s Metadata
              (pod, namespace, labels)
```

## Installation

### Prerequisites

1. EKS cluster with kubectl access
2. Helm 3 installed
3. At least 4Gi of available storage across the cluster

### 1. Add Elastic Helm Repository

```bash
helm repo add elastic https://helm.elastic.co
helm repo update
```

### 2. Create Logging Namespace

```bash
kubectl create namespace logging
```

### 3. Install Elasticsearch

```bash
helm install elasticsearch elastic/elasticsearch \
  --set replicas=1 \
  --set minimumMasterNodes=1 \
  --set resources.requests.cpu=500m \
  --set resources.requests.memory=1Gi \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=2Gi \
  --set volumeClaimTemplate.storageClassName=gp3 \
  --set volumeClaimTemplate.resources.requests.storage=30Gi \
  -n logging
```

Wait for Elasticsearch to be ready:
```bash
kubectl wait --for=condition=ready pod -l app=elasticsearch-master -n logging --timeout=300s
```

### 4. Install Logstash

```bash
helm install logstash elastic/logstash \
  --set replicas=1 \
  --set resources.requests.cpu=200m \
  --set resources.requests.memory=512Mi \
  --set resources.limits.cpu=500m \
  --set resources.limits.memory=1Gi \
  --set persistence.enabled=true \
  --set persistence.storageClassName=gp3 \
  --set persistence.size=5Gi \
  --set-file logstashPipeline.logstash\\.conf=k8s/observability/elk/logstash-pipeline.conf \
  -n logging
```

### 5. Install Kibana

```bash
helm install kibana elastic/kibana \
  --set replicas=1 \
  --set resources.requests.cpu=200m \
  --set resources.requests.memory=512Mi \
  --set resources.limits.cpu=500m \
  --set resources.limits.memory=1Gi \
  --set elasticsearchHosts=http://elasticsearch-master:9200 \
  --set service.type=ClusterIP \
  -n logging
```

### 6. Install Filebeat

```bash
helm install filebeat elastic/filebeat \
  --set daemonset.enabled=true \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi \
  --set resources.limits.cpu=200m \
  --set resources.limits.memory=256Mi \
  --set-file filebeatConfig.filebeat\\.yml=k8s/observability/elk/filebeat-config.yml \
  -n logging
```

## Access

### Kibana

Option A: Port Forward
```bash
kubectl port-forward -n logging svc/kibana-kibana 5601:5601
```
Then open http://localhost:5601

Option B: Via Ingress (if configured)
```bash
kubectl get ingress -n logging kibana-kibana
```

### Elasticsearch API

```bash
kubectl port-forward -n logging svc/elasticsearch-master 9200:9200
```

Test connection:
```bash
curl http://localhost:9200/_cluster/health?pretty
```

## Using Kibana

### 1. Create Index Pattern

On first access to Kibana:

1. Navigate to Stack Management > Index Patterns
2. Click "Create index pattern"
3. Enter pattern: `logstash-*`
4. Select time field: `@timestamp`
5. Click "Create index pattern"

### 2. Discover Logs

1. Navigate to Discover
2. Select the `logstash-*` index pattern
3. Use the search bar for queries:
   - `kubernetes.namespace: "tech-challenge"` - Filter by namespace
   - `kubernetes.pod.name: "tech-challenge-app-*"` - Filter by pod
   - `level: "error"` - Filter by log level
   - `message: *database*` - Search in message

### 3. Create Visualizations

Example: Error Rate Over Time

1. Navigate to Visualizations > Create visualization
2. Select "Line" chart
3. Configure:
   - Y-axis: Count
   - X-axis: Date Histogram on @timestamp
   - Filter: `level: "error"`
4. Save as "Error Rate"

### 4. Create Dashboard

1. Navigate to Dashboard > Create dashboard
2. Add saved visualizations
3. Arrange and resize panels
4. Save dashboard

## Log Format

Application logs should be in JSON format for better parsing:

```json
{
  "timestamp": "2026-01-17T08:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "method": "GET",
  "path": "/api/visits",
  "statusCode": 200,
  "duration": 45
}
```

Filebeat will enrich with Kubernetes metadata:

```json
{
  "@timestamp": "2026-01-17T08:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "kubernetes": {
    "namespace": "tech-challenge",
    "pod": {
      "name": "tech-challenge-app-7d8f9c5b6-x7k2m"
    },
    "container": {
      "name": "app"
    },
    "labels": {
      "app": "tech-challenge-app"
    }
  }
}
```

## Common Queries

### All logs from tech-challenge namespace
```
kubernetes.namespace: "tech-challenge"
```

### Error logs only
```
level: "error" AND kubernetes.namespace: "tech-challenge"
```

### Logs from specific pod
```
kubernetes.pod.name: "tech-challenge-app-7d8f9c5b6-x7k2m"
```

### HTTP 5xx errors
```
statusCode >= 500 AND kubernetes.namespace: "tech-challenge"
```

### Database related logs
```
message: *database* OR message: *mongodb*
```

### Logs in last 15 minutes
Use the time picker in Kibana UI (top right)

## Index Management

### View Indices

```bash
kubectl exec -it -n logging elasticsearch-master-0 -- curl -X GET "localhost:9200/_cat/indices?v"
```

### Delete Old Indices

```bash
# Delete indices older than 30 days
kubectl exec -it -n logging elasticsearch-master-0 -- \
  curl -X DELETE "localhost:9200/logstash-*-$(date -d '30 days ago' +%Y.%m.%d)"
```

### Configure Index Lifecycle Management (ILM)

Create ILM policy to automatically delete old logs:

```bash
kubectl exec -it -n logging elasticsearch-master-0 -- curl -X PUT "localhost:9200/_ilm/policy/logstash-policy" -H 'Content-Type: application/json' -d'
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_age": "1d",
            "max_size": "50gb"
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}'
```

## Troubleshooting

### Elasticsearch not starting

Check pod status:
```bash
kubectl describe pod -n logging elasticsearch-master-0
```

Check logs:
```bash
kubectl logs -n logging elasticsearch-master-0
```

Common issues:
- Insufficient memory (increase limits)
- Storage not available (check PVC)
- Java heap size too large (adjust esJavaOpts)

### No logs in Kibana

1. Check Filebeat is running:
```bash
kubectl get pods -n logging -l app=filebeat
```

2. Check Filebeat logs:
```bash
kubectl logs -n logging -l app=filebeat
```

3. Verify Logstash is receiving logs:
```bash
kubectl logs -n logging -l app=logstash | grep "received"
```

4. Check Elasticsearch indices:
```bash
kubectl exec -n logging elasticsearch-master-0 -- curl "localhost:9200/_cat/indices?v"
```

### Filebeat permission denied

Filebeat needs to read host logs. Check:
```bash
kubectl describe pod -n logging -l app=filebeat
```

Ensure volumes are mounted correctly:
- `/var/log`
- `/var/lib/docker/containers`

### High resource usage

Reduce retention or replicas:
- Decrease Elasticsearch storage
- Reduce log retention period
- Filter more namespaces in Filebeat
- Use sampling for high-volume logs

## Production Recommendations

### 1. Security

Enable Elasticsearch security:
```yaml
esConfig:
  elasticsearch.yml: |
    xpack.security.enabled: true
    xpack.security.transport.ssl.enabled: true
```

Use HTTPS for Kibana ingress with ACM certificate.

### 2. High Availability

Run multiple Elasticsearch nodes:
```yaml
replicas: 3
minimumMasterNodes: 2
```

### 3. Performance

- Use dedicated master nodes for large clusters
- Increase JVM heap (50% of memory limit)
- Use SSD storage (gp3) for better I/O
- Enable compression in Elasticsearch

### 4. Retention

Configure ILM to automatically delete old indices:
- Hot phase: Recent logs (last 7 days)
- Warm phase: Older logs (7-30 days, compressed)
- Delete phase: Remove after 30 days

### 5. Backup

Enable Elasticsearch snapshots to S3:
```yaml
esConfig:
  elasticsearch.yml: |
    s3.client.default.endpoint: s3.amazonaws.com
```

## Cost Optimization

- Use gp3 instead of gp2 (cheaper, better performance)
- Reduce retention period (30 days → 14 days)
- Filter unnecessary namespaces in Filebeat
- Use index lifecycle management
- Consider AWS OpenSearch as managed alternative

## Integration with Application

The application logs are automatically collected by Filebeat. For better structured logging, ensure logs are in JSON format with consistent fields:

```typescript
// Example: Structured logging in NestJS
logger.log({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'User action',
  userId: user.id,
  action: 'login'
});
```

## Cleanup

Remove ELK stack:

```bash
helm uninstall filebeat -n logging
helm uninstall kibana -n logging
helm uninstall logstash -n logging
helm uninstall elasticsearch -n logging
kubectl delete namespace logging
```

## References

- [Elastic Stack Documentation](https://www.elastic.co/guide/index.html)
- [Filebeat Kubernetes](https://www.elastic.co/guide/en/beats/filebeat/current/running-on-kubernetes.html)
- [Elasticsearch on Kubernetes](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html)
- [Kibana Query Language (KQL)](https://www.elastic.co/guide/en/kibana/current/kuery-query.html)
