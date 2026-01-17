# Observability Stack Overview

This directory contains three observability solutions for the Tech Challenge application:

## 1. Prometheus + Grafana (Metrics) - Required

**Purpose**: Real-time metrics collection and visualization

**Location**: `k8s/observability/prometheus/`, `k8s/observability/grafana/`

**Components**:
- Prometheus: Time-series database for metrics
- Grafana: Visualization and dashboards (with persistent storage)
- AlertManager: Alert routing and notifications
- Node Exporter: Node-level metrics
- MongoDB Exporter: Database metrics

**Metrics Collected**:
- Request rate, latency (p95, p99), error rate
- CPU and memory usage
- Pod health and availability
- MongoDB connections and operations
- Container metrics

**Use Cases**:
- Performance monitoring
- Capacity planning
- SLA tracking
- Real-time alerting

**Installation**: See main `README.md`

**Status**: Deployed with persistent storage (10Gi for Grafana)

## 2. Loki Stack (Lightweight Logging) - Recommended

**Purpose**: Cost-effective log aggregation with Grafana integration

**Location**: `k8s/observability/loki/`

**Components**:
- Loki: Label-based log aggregation
- Promtail: Log collection from all pods (DaemonSet)
- Grafana: Same UI for logs + metrics (already deployed)

**Features**:
- 30-day retention with auto-compaction
- 10x compression (50Gi stores ~500Gi of logs)
- Native Grafana integration
- Label-based indexing (much lighter than full-text)
- Automatic log cleanup every 10 minutes

**Logs Collected**:
- Application logs from all containers
- Kubernetes metadata (namespace, pod, labels)
- JSON log parsing
- Filtered to exclude kube-system

**Use Cases**:
- Debugging and troubleshooting
- Quick log searches by labels
- Correlation with metrics in Grafana
- Cost-effective logging

**Installation**: See `loki/README.md`

**Resource Usage**: ~300m CPU, 640Mi-1.13Gi memory, 50Gi storage

## 3. ELK Stack (Full-Text Logging) - Optional

**Purpose**: Advanced log analysis with full-text search

**Location**: `k8s/observability/elk/`

**Components**:
- Elasticsearch: Full-text search engine
- Logstash: Complex log processing
- Kibana: Dedicated log UI
- Filebeat: Log collection

**Logs Collected**:
- All application and system logs
- Full-text indexed
- Complex transformations
- Enriched metadata

**Use Cases**:
- Compliance and auditing
- Deep log analysis
- Full-text search across logs
- High-volume log processing

**Installation**: See `elk/README.md`

**Resource Usage**: ~900m-2000m CPU, 2.2-4.7Gi memory, 35Gi storage

**Use Cases**:
- Debugging and troubleshooting
- Audit trails
- Error analysis
- Security monitoring

**Installation**: See `elk/README.md`

## Choosing Your Logging Solution

| Feature | Loki | ELK |
|---------|------|-----|
| **Indexing** | Labels only | Full-text |
| **Storage** | 50Gi (30 days) | 30Gi (30 days) |
| **Resource** | ~640Mi memory | ~2.5Gi memory |
| **Cost** | Low ($50/month) | High ($150/month) |
| **Grafana Integration** | Native | External |
| **Query Speed** | Fast (label-based) | Fast (full-text) |
| **Complexity** | Simple | Complex |
| **Best For** | General debugging | Compliance/audit |

## Why Metrics + Logs?

**Metrics (Prometheus)** and **Logs (Loki/ELK)** serve different purposes:

| Aspect | Metrics | Logs |
|--------|---------|------|
| **Data Type** | Numerical time-series | Text events |
| **Question** | "How much?" "How fast?" | "What happened?" "Why?" |
| **Storage** | Efficient, aggregated | Verbose, detailed |
| **Query** | Mathematical operations | Text search |
| **Retention** | 15 days | 30 days |
| **Use Case** | Monitoring, alerting | Debugging, auditing |

### Examples

**Use Metrics when**:
- "What's the current CPU usage?"
- "How many requests per second?"
- "Is latency above SLA?"

**Use Logs when**:
- "Why did this request fail?"
- "What was the error message?"
- "Who accessed this resource?"

## Recommended Setup

### Development / Testing
- **Prometheus + Grafana** (required for metrics)
- **Loki** (optional, lightweight logs)

### Production (Cost-Conscious)
- **Prometheus + Grafana** (metrics and alerting)
- **Loki** (logs for 30 days, 60-70% cheaper than ELK)

### Production (Compliance/Enterprise)
- **Prometheus + Grafana** (metrics)
- **Loki** (recent logs, 7-30 days)
- **ELK** (compliance logs, 90+ days retention)

## Resource Requirements

### Prometheus Stack (Required)
- Prometheus: 200m-1000m CPU, 512Mi-2Gi memory, 20Gi storage
- Grafana: 100m-500m CPU, 256Mi-512Mi memory, 10Gi storage (persistent)
- AlertManager: 50m-200m CPU, 128Mi-256Mi memory, 5Gi storage
- Exporters: 50m-200m CPU each, 64Mi-128Mi memory each

**Total**: ~600m-2000m CPU, ~1.5Gi-4Gi memory, ~40Gi storage

### Loki Stack (Recommended for Logging)
- Loki: 200m-1000m CPU, 512Mi-1Gi memory, 50Gi storage
- Promtail: 100m-200m CPU per node, 128Mi-256Mi memory per node
- Grafana: Shared with Prometheus (no additional cost)

**Total**: ~300m-1200m CPU, ~640Mi-1.26Gi memory, ~50Gi storage

### ELK Stack (Optional, for Compliance)
- Elasticsearch: 500m-1000m CPU, 1-2Gi memory, 30Gi storage
- Logstash: 200m-500m CPU, 512Mi-1Gi memory, 5Gi storage
- Kibana: 200m-500m CPU, 512Mi-1Gi memory
- Filebeat: 100m-200m CPU per node, 128Mi-256Mi memory per node

**Total**: ~1000m-2500m CPU, ~2.5Gi-5Gi memory, ~35Gi storage

### Setup Comparisons

**Prometheus + Loki (Recommended)**:
- **CPU**: ~900m-3200m (0.9-3.2 cores)
- **Memory**: ~2.14Gi-5.26Gi
- **Storage**: ~90Gi
- **Cost**: ~$120/month

**Prometheus + ELK**:
- **CPU**: ~1600m-4500m (1.6-4.5 cores)
- **Memory**: ~4-9Gi
- **Storage**: ~75Gi
- **Cost**: ~$230/month

**All Three**:
- **CPU**: ~1900m-5700m (1.9-5.7 cores)
- **Memory**: ~4.64Gi-10.26Gi
- **Storage**: ~125Gi
- **Cost**: ~$280/month

## Cost Optimization

1. **Reduce retention periods**:
   - Metrics: 15 days → 7 days
   - Logs: 30 days → 14 days

2. **Use efficient storage**:
   - gp3 volumes (better price/performance than gp2)

3. **Scale down in dev environments**:
   - 1 replica for everything
   - Smaller resource limits

4. **Filter logs**:
   - Exclude debug logs in production
   - Filter noisy namespaces (kube-system)

5. **Consider managed alternatives**:
   - AWS CloudWatch (native integration)
   - AWS OpenSearch (managed ELK)
   - Grafana Cloud (managed Prometheus)

## Access URLs

After installation:

- **Grafana**: http://localhost:3000 (port-forward)
- **Prometheus**: http://localhost:9090 (port-forward)
- **Kibana**: http://localhost:5601 (port-forward)

Or configure Ingress for external access.

## Quick Start

### 1. Install Prometheus Stack
```bash
helm install prometheus prometheus-community/kube-prometheus-stack \
  -f k8s/observability/kube-prometheus-stack-values.yaml \
  -n monitoring \
  --create-namespace
```

### 2. Install ELK Stack
```bash
# Elasticsearch
helm install elasticsearch elastic/elasticsearch -n logging --create-namespace

# Logstash
helm install logstash elastic/logstash -n logging

# Kibana
helm install kibana elastic/kibana -n logging

# Filebeat
helm install filebeat elastic/filebeat -n logging
```

### 3. Deploy Application Monitoring
```bash
kubectl apply -f k8s/observability/servicemonitors/
kubectl apply -f k8s/observability/prometheus/alert-rules.yaml
```

## Troubleshooting

### Metrics Not Showing
1. Check ServiceMonitor is created
2. Verify Prometheus is scraping (check targets)
3. Ensure app exposes /metrics endpoint

### Logs Not Appearing
1. Check Filebeat DaemonSet is running
2. Verify Logstash is receiving logs
3. Check Elasticsearch indices exist
4. Create Kibana index pattern

## References

- [Prometheus Documentation](prometheus/README.md)
- [ELK Stack Documentation](elk/README.md)
- [Alert Rules](prometheus/alert-rules.yaml)
- [Grafana Dashboards](grafana/)
