# Observability Stack for Tech Challenge

This directory contains the observability configuration for monitoring the Tech Challenge application using Prometheus and Grafana.

## Architecture

The observability stack consists of:

### Prometheus
- **Metrics Collection**: Scrapes metrics from application and MongoDB
- **Time Series Database**: Stores metrics with 15-day retention
- **Alert Evaluation**: Evaluates alerting rules and triggers notifications
- **Storage**: 20Gi persistent volume (gp3)

### Grafana
- **Visualization**: Dashboards for application and infrastructure metrics
- **Data Source**: Configured to use Prometheus
- **Dashboards**: Pre-built Kubernetes dashboards + custom Tech Challenge dashboard
- **Storage**: 10Gi persistent volume (gp3)

### AlertManager
- **Alert Routing**: Routes alerts based on severity and labels
- **Notification Channels**: Supports Slack, PagerDuty, email, webhooks
- **Grouping**: Groups related alerts to reduce noise
- **Storage**: 5Gi persistent volume (gp3)

### Exporters
- **Node Exporter**: Collects hardware and OS metrics from nodes
- **Kube State Metrics**: Exposes Kubernetes object metrics
- **MongoDB Exporter**: Collects MongoDB-specific metrics

## Metrics Collected

### Application Metrics
- Request rate (requests per second)
- Error rate (5xx responses)
- Request latency (p95, p99)
- Pod health and availability
- CPU and memory usage
- Container restarts

### MongoDB Metrics
- Connection count (current, available)
- Operation counters (insert, query, update, delete)
- Replication lag (if using replica sets)
- Memory usage
- Query execution time

### Kubernetes Metrics
- Pod status and phases
- Deployment replica counts
- Resource usage vs limits
- PVC usage and capacity
- Node health and resources

## Installation

### Prerequisites

1. EKS cluster with kubectl access
2. Helm 3 installed
3. At least 3Gi of available storage

### 1. Add Prometheus Community Helm Repository

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### 2. Create Monitoring Namespace

```bash
kubectl create namespace monitoring
```

### 3. Install kube-prometheus-stack

```bash
helm install prometheus prometheus-community/kube-prometheus-stack \
  -f k8s/observability/kube-prometheus-stack-values.yaml \
  -n monitoring \
  --create-namespace
```

This will install:
- Prometheus Operator
- Prometheus server
- Grafana
- AlertManager
- Node Exporter
- Kube State Metrics
- Default alerting rules

### 4. Deploy Application Monitoring

```bash
# Deploy ServiceMonitors
kubectl apply -f k8s/observability/servicemonitors/

# Deploy custom alert rules
kubectl apply -f k8s/observability/prometheus/alert-rules.yaml
```

### 5. Import Custom Dashboard

Option A: Via Grafana UI
1. Access Grafana (see Access section below)
2. Navigate to Dashboards > Import
3. Upload `k8s/observability/grafana/tech-challenge-dashboard.json`

Option B: Via ConfigMap
```bash
kubectl create configmap tech-challenge-dashboard \
  --from-file=k8s/observability/grafana/tech-challenge-dashboard.json \
  -n monitoring \
  -o yaml --dry-run=client | kubectl apply -f -

# Label for automatic discovery
kubectl label configmap tech-challenge-dashboard \
  -n monitoring \
  grafana_dashboard=1
```

## Access

### Grafana

Get the Grafana admin password:
```bash
kubectl get secret prometheus-grafana \
  -n monitoring \
  -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```

Access Grafana UI:

Option A: Port Forward
```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```
Then open http://localhost:3000 (user: admin)

Option B: Via Ingress (if configured)
```bash
kubectl get ingress -n monitoring prometheus-grafana
```

### Prometheus

Access Prometheus UI:
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```
Then open http://localhost:9090

### AlertManager

Access AlertManager UI:
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-alertmanager 9093:9093
```
Then open http://localhost:9093

## Dashboards

### Pre-built Dashboards

The following dashboards are imported automatically:

1. **Kubernetes Cluster** (ID: 7249)
   - Cluster-wide resource usage
   - Node health and capacity
   - Pod distribution

2. **Kubernetes Pods** (ID: 6417)
   - Pod CPU and memory usage
   - Network I/O
   - Container restarts

3. **Node Exporter** (ID: 1860)
   - Node-level metrics
   - CPU, memory, disk, network
   - System load

### Custom Tech Challenge Dashboard

Panels included:
- Request Rate: HTTP requests per second
- Error Rate: Percentage of 5xx responses
- Request Latency: p95 and p99 latency
- Pod Health: Number of running pods
- Memory Usage: Container memory consumption
- CPU Usage: Container CPU usage
- MongoDB Connections: Active database connections
- MongoDB Operations: Database operation rates

## Alerting

### Alert Rules

The following alerts are configured:

#### Application Alerts (Critical)
- **HighErrorRate**: Error rate > 5% for 5 minutes
- **PodDown**: No healthy application pods available
- **ServiceUnavailable**: Service not responding to health checks

#### Application Alerts (Warning)
- **HighRequestLatency**: p95 latency > 1s for 5 minutes
- **HighPodRestartRate**: Pods restarting frequently
- **ProbeFailures**: Readiness probes failing

#### Database Alerts (Critical)
- **MongoDBDown**: MongoDB not responding

#### Database Alerts (Warning)
- **HighMongoDBConnections**: More than 80 active connections
- **MongoDBReplicationLag**: Replication lag > 10s

#### Resource Alerts (Warning)
- **HighMemoryUsage**: Container using > 90% of memory limit
- **HighCPUUsage**: Container using > 80% of CPU limit
- **PVCAlmostFull**: Persistent volume > 85% full

### Configure Alert Notifications

Edit the AlertManager configuration in `kube-prometheus-stack-values.yaml`:

#### Slack Integration
```yaml
receivers:
  - name: 'critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts-critical'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

#### PagerDuty Integration
```yaml
receivers:
  - name: 'critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
```

#### Email Integration
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'
  smtp_auth_username: 'alerts@example.com'
  smtp_auth_password: 'your-password'

receivers:
  - name: 'critical'
    email_configs:
      - to: 'oncall@example.com'
```

Then upgrade the Helm release:
```bash
helm upgrade prometheus prometheus-community/kube-prometheus-stack \
  -f k8s/observability/kube-prometheus-stack-values.yaml \
  -n monitoring
```

## Troubleshooting

### Prometheus not scraping metrics

Check ServiceMonitor configuration:
```bash
kubectl get servicemonitor -n tech-challenge
kubectl describe servicemonitor tech-challenge-app -n tech-challenge
```

Check Prometheus targets:
```bash
# Access Prometheus UI and navigate to Status > Targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

### Grafana dashboard shows no data

1. Verify data source connection:
   - Grafana UI > Configuration > Data Sources
   - Test Prometheus connection

2. Check Prometheus is collecting metrics:
   - Prometheus UI > Graph
   - Query: `up{namespace="tech-challenge"}`

3. Verify time range in dashboard

### Alerts not firing

Check alert rule status:
```bash
# Access Prometheus UI > Alerts
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

Check AlertManager logs:
```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=alertmanager -f
```

### High resource usage

Reduce Prometheus retention:
```yaml
prometheus:
  prometheusSpec:
    retention: 7d  # Instead of 15d
```

Reduce scrape frequency:
```yaml
prometheus:
  prometheusSpec:
    scrapeInterval: 60s  # Instead of 30s
```

## Production Recommendations

### 1. Persistent Storage
- Use gp3 volumes for better performance
- Enable volume snapshots for backups
- Monitor PVC usage with alerts

### 2. High Availability
- Run multiple Prometheus replicas
- Use Thanos for long-term storage
- Deploy AlertManager in HA mode

### 3. Security
- Enable authentication on Grafana (already configured)
- Use HTTPS with ACM certificates for Ingress
- Restrict Prometheus access to authorized users
- Use IRSA for AWS Secrets Manager integration

### 4. Performance
- Adjust retention based on storage capacity
- Use recording rules for complex queries
- Enable query caching in Grafana

### 5. Cost Optimization
- Use gp3 instead of gp2 (cheaper, better performance)
- Right-size PVC based on actual usage
- Consider using CloudWatch for long-term storage (AWS native)

## Retention and Storage

### Default Configuration
- **Prometheus**: 15 days, 10GB size limit, 20Gi PVC
- **Grafana**: Indefinite (dashboard configs only), 10Gi PVC
- **AlertManager**: 120 hours, 5Gi PVC

### Calculating Storage Requirements

Approximate formula:
```
storage_bytes = ingested_samples_per_second * bytes_per_sample * retention_seconds
```

For our setup:
- ~1000 samples/sec
- ~2 bytes/sample
- 15 days retention (1,296,000 seconds)
- = ~2.5 GB

20Gi PVC provides comfortable headroom for growth.

## Integration with Application

### Enabling Metrics in NestJS App

The app needs to expose Prometheus metrics. Add to `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as promClient from 'prom-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Create metrics registry
  const register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register });

  // Expose /metrics endpoint
  app.use('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  await app.listen(3000);
}
bootstrap();
```

Install dependency:
```bash
npm install prom-client
```

Note: This is documented for completeness but not required for DevOps challenge.

## Useful PromQL Queries

### Request rate
```promql
rate(http_requests_total{namespace="tech-challenge"}[5m])
```

### Error rate percentage
```promql
sum(rate(http_requests_total{namespace="tech-challenge",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{namespace="tech-challenge"}[5m]))
* 100
```

### Memory usage percentage
```promql
container_memory_working_set_bytes{namespace="tech-challenge"}
/
container_spec_memory_limit_bytes{namespace="tech-challenge"}
* 100
```

### Pod restart count
```promql
kube_pod_container_status_restarts_total{namespace="tech-challenge"}
```

## Cleanup

Remove observability stack:
```bash
helm uninstall prometheus -n monitoring
kubectl delete namespace monitoring
```

Remove application monitoring:
```bash
kubectl delete -f k8s/observability/servicemonitors/
kubectl delete -f k8s/observability/prometheus/alert-rules.yaml
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [MongoDB Exporter](https://github.com/percona/mongodb_exporter)
