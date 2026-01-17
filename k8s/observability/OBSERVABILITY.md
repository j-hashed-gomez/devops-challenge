# Observability Stack Overview

This directory contains two complementary observability solutions for the Tech Challenge application:

## 1. Prometheus + Grafana (Metrics)

**Purpose**: Real-time metrics collection and visualization

**Location**: `k8s/observability/prometheus/`, `k8s/observability/grafana/`

**Components**:
- Prometheus: Time-series database for metrics
- Grafana: Visualization and dashboards
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

**Installation**: See `README.md` in main observability directory

## 2. ELK Stack (Logging)

**Purpose**: Centralized log aggregation and analysis

**Location**: `k8s/observability/elk/`

**Components**:
- Elasticsearch: Log storage and search engine
- Logstash: Log processing pipeline
- Kibana: Log exploration and visualization
- Filebeat: Log collection from all pods

**Logs Collected**:
- Application logs from all containers
- System logs
- Kubernetes events
- Enriched with pod/namespace metadata

**Use Cases**:
- Debugging and troubleshooting
- Audit trails
- Error analysis
- Security monitoring

**Installation**: See `elk/README.md`

## Why Both?

**Metrics (Prometheus)** and **Logs (ELK)** serve different purposes:

| Aspect | Metrics | Logs |
|--------|---------|------|
| **Data Type** | Numerical time-series | Text events |
| **Question** | "How much?" "How fast?" | "What happened?" "Why?" |
| **Storage** | Efficient, aggregated | Verbose, detailed |
| **Query** | Mathematical operations | Full-text search |
| **Retention** | 15 days (default) | 30 days (default) |
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

### Development
- Prometheus + Grafana (lighter, faster feedback)

### Production
- **Both stacks** for complete observability
- Metrics for monitoring and alerting
- Logs for debugging and compliance

## Resource Requirements

### Prometheus Stack
- Prometheus: 200m-1000m CPU, 512Mi-2Gi memory, 20Gi storage
- Grafana: 100m-500m CPU, 256Mi-512Mi memory, 10Gi storage
- AlertManager: 50m-200m CPU, 128Mi-256Mi memory, 5Gi storage
- Exporters: 50m-200m CPU each, 64Mi-128Mi memory each

**Total**: ~600m-2000m CPU, ~1.5Gi-4Gi memory, ~40Gi storage

### ELK Stack
- Elasticsearch: 500m-1000m CPU, 1-2Gi memory, 30Gi storage
- Logstash: 200m-500m CPU, 512Mi-1Gi memory, 5Gi storage
- Kibana: 200m-500m CPU, 512Mi-1Gi memory
- Filebeat: 100m-200m CPU per node, 128Mi-256Mi memory per node

**Total**: ~1000m-2500m CPU, ~2.5Gi-5Gi memory, ~35Gi storage

### Combined Total
- **CPU**: 1.6-4.5 cores
- **Memory**: 4-9Gi
- **Storage**: 75Gi

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
