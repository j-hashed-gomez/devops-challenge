# Loki Stack for Lightweight Logging

Loki is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be very cost effective and easy to operate, as it does not index the contents of the logs, but rather a set of labels for each log stream.

## Why Loki over ELK?

| Feature | Loki | ELK |
|---------|------|-----|
| **Indexing** | Labels only | Full-text |
| **Storage** | Much smaller | Large |
| **Query Speed** | Fast for label queries | Fast for full-text |
| **Resource Usage** | Low | High |
| **Cost** | Low | High |
| **Grafana Integration** | Native | Plugin |
| **Complexity** | Simple | Complex |

**Use Loki when**:
- You want lower costs and resource usage
- You use Grafana already
- Label-based queries are sufficient
- You don't need full-text search across all logs

**Use ELK when**:
- You need full-text search
- You have compliance requirements for detailed log analysis
- You already use Elastic ecosystem
- Resource cost is not a constraint

## Architecture

```
Container Logs → Promtail (DaemonSet) → Loki → Grafana
                     ↓
               K8s Labels
```

### Components

1. **Loki**: Log aggregation system
   - Stores logs compressed and indexed by labels
   - 30-day retention with auto-compaction
   - 50Gi persistent storage

2. **Promtail**: Log collector (DaemonSet)
   - Runs on every node
   - Collects container logs
   - Enriches with Kubernetes metadata
   - Sends to Loki

3. **Grafana**: Already deployed with Prometheus
   - Explore logs alongside metrics
   - Create dashboards with logs + metrics
   - Correlation between metrics and logs

## Features

### Automatic Compaction
- Runs every 10 minutes
- Removes old chunks automatically
- Retention: 30 days
- Frees up storage space

### Label-Based Indexing
Only indexes labels, not log contents:
```
{namespace="tech-challenge", pod="app-123", container="app", level="error"}
```

### Integration with Grafana
- Same UI for logs and metrics
- Correlate metrics with logs
- Split view: metrics on top, logs on bottom
- Time-sync between panels

## Installation

### Prerequisites

1. Grafana already installed (from kube-prometheus-stack)
2. Helm 3
3. At least 2Gi memory and 50Gi storage available

### 1. Add Grafana Helm Repository

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### 2. Install Loki Stack

```bash
helm install loki grafana/loki-stack \
  -f k8s/observability/loki/loki-stack-values.yaml \
  -n logging \
  --create-namespace
```

This installs:
- Loki (log aggregation)
- Promtail (log collection)

### 3. Configure Grafana Data Source

If using kube-prometheus-stack Grafana, add Loki datasource:

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-datasource
  namespace: monitoring
  labels:
    grafana_datasource: "1"
data:
  loki-datasource.yaml: |-
    apiVersion: 1
    datasources:
      - name: Loki
        type: loki
        access: proxy
        url: http://loki.logging.svc.cluster.local:3100
        isDefault: false
        version: 1
        editable: false
EOF
```

Restart Grafana to pick up the datasource:
```bash
kubectl rollout restart deployment prometheus-grafana -n monitoring
```

## Using Loki in Grafana

### 1. Access Grafana

```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

Open http://localhost:3000 (admin/password from kube-prometheus-stack-values.yaml)

### 2. Explore Logs

1. Navigate to **Explore** (compass icon)
2. Select **Loki** datasource
3. Use LogQL to query logs

### 3. Example LogQL Queries

#### All logs from tech-challenge namespace
```logql
{namespace="tech-challenge"}
```

#### Error logs only
```logql
{namespace="tech-challenge"} |= "error"
```

#### Logs from specific pod
```logql
{namespace="tech-challenge", pod=~"tech-challenge-app-.*"}
```

#### Rate of errors
```logql
rate({namespace="tech-challenge"} |= "error" [5m])
```

#### JSON field extraction
```logql
{namespace="tech-challenge"} | json | level="error"
```

#### Pattern matching
```logql
{namespace="tech-challenge"} |~ "database.*connection"
```

### 4. Create Dashboard with Logs

Example dashboard combining metrics and logs:

1. Create new dashboard
2. Add panel with Prometheus query (e.g., error rate)
3. Add panel with Loki query showing errors
4. Link time ranges
5. Save dashboard

## LogQL Syntax

### Label Selectors
```logql
{namespace="tech-challenge"}
{namespace="tech-challenge", app="tech-challenge-app"}
{namespace=~"tech-.*"}  # Regex
```

### Line Filters
```logql
{namespace="tech-challenge"} |= "error"     # Contains
{namespace="tech-challenge"} != "debug"     # Does not contain
{namespace="tech-challenge"} |~ "error|warn"  # Regex match
{namespace="tech-challenge"} !~ "debug"     # Regex not match
```

### JSON Parsing
```logql
{namespace="tech-challenge"} | json | level="error"
{namespace="tech-challenge"} | json | statusCode >= 500
```

### Aggregations
```logql
count_over_time({namespace="tech-challenge"}[5m])
rate({namespace="tech-challenge"} |= "error" [1m])
sum by (pod) (rate({namespace="tech-challenge"}[5m]))
```

## Retention and Storage

### Configuration

- **Retention Period**: 30 days (720 hours)
- **Compaction Interval**: 10 minutes
- **Storage**: 50Gi gp3 volume
- **Deletion Delay**: 2 hours after marking for deletion

### Storage Calculation

Approximate formula:
```
storage = log_rate * avg_log_size * retention_days * compression_ratio
```

For our setup:
- 100 logs/sec
- 200 bytes/log average
- 30 days retention
- 10x compression
- = ~5GB (50Gi provides comfortable headroom)

### Manual Retention Management

Check Loki storage usage:
```bash
kubectl exec -it -n logging loki-0 -- du -sh /loki
```

Force compaction:
```bash
kubectl exec -it -n logging loki-0 -- wget -O- http://localhost:3100/loki/api/v1/delete?query={namespace="old-namespace"}&start=0&end=$(date -d '30 days ago' +%s)000000000
```

## Monitoring Loki

### Metrics

Loki exposes Prometheus metrics on port 3100:

```bash
kubectl port-forward -n logging svc/loki 3100:3100
curl http://localhost:3100/metrics
```

### ServiceMonitor

Already included in values (if Prometheus Operator is installed):

```yaml
serviceMonitor:
  enabled: true
  labels:
    prometheus: enabled
```

### Key Metrics

- `loki_ingester_chunks_flushed_total`: Chunks written to storage
- `loki_distributor_bytes_received_total`: Bytes received
- `loki_request_duration_seconds`: Query performance

## Troubleshooting

### No logs appearing

1. **Check Promtail is running**:
```bash
kubectl get pods -n logging -l app.kubernetes.io/name=promtail
```

2. **Check Promtail logs**:
```bash
kubectl logs -n logging -l app.kubernetes.io/name=promtail
```

3. **Verify Promtail can reach Loki**:
```bash
kubectl exec -n logging -it $(kubectl get pod -n logging -l app.kubernetes.io/name=promtail -o jsonpath='{.items[0].metadata.name}') -- wget -O- http://loki:3100/ready
```

4. **Check Loki is ready**:
```bash
kubectl logs -n logging loki-0
```

### Promtail permission denied

Promtail needs to read host logs:

```bash
kubectl describe pod -n logging -l app.kubernetes.io/name=promtail
```

Ensure volumes are mounted:
- `/var/log`
- `/var/lib/docker/containers`

### High memory usage

Reduce ingestion rate or query concurrency:

```yaml
limits_config:
  ingestion_rate_mb: 5  # Reduce from 10
  max_query_parallelism: 16  # Reduce from 32
```

### Storage filling up

- Reduce retention: 720h → 360h (15 days)
- Increase storage: 50Gi → 100Gi
- Enable more aggressive compaction
- Filter more namespaces in Promtail

## Production Recommendations

### 1. High Availability

Run multiple Loki replicas:
```yaml
loki:
  replicas: 3
```

Use object storage (S3) instead of local filesystem:
```yaml
storage_config:
  aws:
    s3: s3://region/bucket
    sse_encryption: true
```

### 2. Performance

- Use SSD storage (gp3)
- Increase compaction workers
- Enable query caching
- Use dedicated ingester nodes

### 3. Security

- Enable authentication
- Use TLS for Loki API
- Restrict namespace access with multi-tenancy
- Use HTTPS for Grafana ingress

### 4. Cost Optimization

- Use S3 Intelligent-Tiering for storage
- Reduce retention (30 days → 7 days)
- Filter debug logs in Promtail
- Use gp3 instead of gp2

### 5. Backup

Enable periodic backups:
```bash
# Backup Loki data
kubectl exec -n logging loki-0 -- tar czf /tmp/loki-backup.tar.gz /loki

# Copy to local
kubectl cp logging/loki-0:/tmp/loki-backup.tar.gz ./loki-backup.tar.gz
```

## Comparison: Loki vs ELK

### Resource Usage

| Component | Loki | ELK |
|-----------|------|-----|
| **Log Storage** | Loki: 200m CPU, 512Mi-1Gi | Elasticsearch: 500m-1000m CPU, 1-2Gi |
| **Log Processing** | Promtail: 100m CPU, 128Mi | Logstash: 200m-500m CPU, 512Mi-1Gi |
| **UI** | Grafana (shared) | Kibana: 200m-500m CPU, 512Mi-1Gi |
| **Total** | ~300m CPU, 640Mi-1.13Gi | ~900m-2000m CPU, 2.2-4.7Gi |

### Storage

- **Loki**: 10-50Gi for 30 days (10x compression)
- **ELK**: 30-100Gi for 30 days (less compression)

### Cost (AWS EKS)

Monthly estimate for 30-day retention:

- **Loki**: ~$50/month (storage + compute)
- **ELK**: ~$150-200/month (storage + compute)

**Savings**: 60-70% with Loki

## When to Use What

### Use Loki if:
- You use Grafana already
- You want cost-effective logging
- Label-based queries are sufficient
- You have <1TB/day log volume

### Use ELK if:
- You need full-text search
- You have compliance requirements
- You need complex log analysis
- You have >1TB/day log volume

### Use Both if:
- Loki for recent logs (7-30 days) and quick queries
- ELK for compliance logs (90+ days) and deep analysis
- Route critical logs to both, general logs to Loki only

## Cleanup

Remove Loki stack:

```bash
helm uninstall loki -n logging
kubectl delete namespace logging
```

## References

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Guide](https://grafana.com/docs/loki/latest/logql/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/)
- [Grafana Explore](https://grafana.com/docs/grafana/latest/explore/)
