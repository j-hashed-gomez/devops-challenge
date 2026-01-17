# Prometheus Monitoring Configuration

This directory contains Prometheus configuration for monitoring the Tech Challenge application.

## Components

### ServiceMonitors
- `servicemonitors/app-servicemonitor.yaml` - Scrapes application `/metrics` endpoint
- `servicemonitors/mongodb-servicemonitor.yaml` - Scrapes MongoDB metrics

### Alert Rules
- `alert-rules.yaml` - PrometheusRule with 19 alert definitions

## Key Metrics Tracked

### 1. Request Latency
**Metrics**:
- `http_request_duration_seconds_bucket` - Histogram of request durations
- Percentiles tracked: p50, p95, p99

**Queries**:
```promql
# p95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="tech-challenge"}[5m])) by (le))

# p99 latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace="tech-challenge"}[5m])) by (le))
```

**Alerts**:
- `HighRequestLatency`: p95 > 1s for 5 minutes
- `CriticalRequestLatency`: p99 > 3s for 5 minutes

### 2. Error Rates
**Metrics**:
- `http_requests_total{status=~"5.."}` - 5xx server errors
- `http_requests_total{status=~"4.."}` - 4xx client errors
- `http_requests_total{status=~"2.."}` - 2xx success

**Queries**:
```promql
# Error rate (5xx)
sum(rate(http_requests_total{namespace="tech-challenge", status=~"5.."}[5m]))
/
sum(rate(http_requests_total{namespace="tech-challenge"}[5m]))

# Request rate by status
sum(rate(http_requests_total{namespace="tech-challenge"}[5m])) by (status)
```

**Alerts**:
- `HighErrorRate`: > 5% error rate for 5 minutes (CRITICAL)
- `ModerateErrorRate`: > 1% error rate for 10 minutes (WARNING)

### 3. Container Health
**Metrics**:
- `up{app="tech-challenge-app"}` - Target up/down status
- `kube_pod_container_status_ready` - Pod readiness status
- `kube_pod_container_status_restarts_total` - Container restart count

**Queries**:
```promql
# Pod health (1=up, 0=down)
up{namespace="tech-challenge", app="tech-challenge-app"}

# Pod readiness
kube_pod_container_status_ready{namespace="tech-challenge", pod=~"tech-challenge-app.*"}

# Restart rate
rate(kube_pod_container_status_restarts_total{namespace="tech-challenge"}[15m])
```

**Alerts**:
- `PodDown`: Pod is down for 1 minute (CRITICAL)
- `PodNotReady`: Pod not ready for 5 minutes (WARNING)
- `HighPodRestartRate`: > 0.1 restarts/sec for 5 minutes (WARNING)
- `PodCrashLooping`: > 0.5 restarts/sec for 5 minutes (CRITICAL)

## Installation

### Step 1: Apply ServiceMonitors

```bash
kubectl apply -f k8s/observability/servicemonitors/
```

Verify:
```bash
kubectl get servicemonitor -n monitoring
```

### Step 2: Apply Alert Rules

```bash
kubectl apply -f k8s/observability/prometheus/alert-rules.yaml
```

Verify:
```bash
kubectl get prometheusrule -n monitoring
```

Check rules in Prometheus UI:
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090/rules
```

### Step 3: Verify Metrics are Being Scraped

```bash
# Port-forward Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# Open http://localhost:9090
# Go to Status > Targets
# Look for tech-challenge-app targets
```

You should see:
- `monitoring/tech-challenge-app/0` - Application metrics endpoint
- `monitoring/mongodb/0` - MongoDB metrics endpoint

### Step 4: Test Queries

In Prometheus UI (http://localhost:9090/graph), try these queries:

```promql
# Request rate
rate(http_requests_total{namespace="tech-challenge"}[5m])

# Latency p95
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="tech-challenge"}[5m])) by (le))

# Error rate
sum(rate(http_requests_total{namespace="tech-challenge", status=~"5.."}[5m])) / sum(rate(http_requests_total{namespace="tech-challenge"}[5m]))

# Pod health
up{namespace="tech-challenge"}
```

## Alert Testing

### Trigger Test Alerts

#### 1. Test HighErrorRate

```bash
# Generate 500 errors
for i in {1..100}; do
  kubectl exec -n tech-challenge deployment/tech-challenge-app -- \
    curl -X POST http://localhost:3000/error-endpoint || true
done
```

Wait 5 minutes and check:
```bash
kubectl get prometheusalerts -n monitoring
```

#### 2. Test HighRequestLatency

```bash
# Generate slow requests (if endpoint exists)
for i in {1..50}; do
  kubectl exec -n tech-challenge deployment/tech-challenge-app -- \
    curl -X GET http://localhost:3000/slow-endpoint || true
done
```

#### 3. Test PodDown

```bash
# Scale down to 0
kubectl scale deployment tech-challenge-app -n tech-challenge --replicas=0

# Wait 1 minute, then check alerts
kubectl get prometheusalerts -n monitoring

# Scale back up
kubectl scale deployment tech-challenge-app -n tech-challenge --replicas=2
```

## Alert Notification

### Configure AlertManager

Edit AlertManager configuration to send notifications:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-prometheus-kube-prometheus-alertmanager
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'slack'
      routes:
      - match:
          severity: critical
        receiver: 'slack-critical'
    receivers:
    - name: 'slack'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#tech-challenge-alerts'
        title: 'Tech Challenge Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    - name: 'slack-critical'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#tech-challenge-critical'
        title: '[CRITICAL] Tech Challenge Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

Apply:
```bash
kubectl apply -f alertmanager-config.yaml
```

## Metrics Exported by Application

The application must export these metrics via `/metrics` endpoint:

### Required Metrics

```prometheus
# Request duration histogram
http_request_duration_seconds_bucket{le="0.005"} 10
http_request_duration_seconds_bucket{le="0.01"} 25
http_request_duration_seconds_bucket{le="0.025"} 50
http_request_duration_seconds_bucket{le="0.05"} 100
http_request_duration_seconds_bucket{le="0.1"} 200
http_request_duration_seconds_bucket{le="0.25"} 300
http_request_duration_seconds_bucket{le="0.5"} 400
http_request_duration_seconds_bucket{le="1"} 450
http_request_duration_seconds_bucket{le="2.5"} 480
http_request_duration_seconds_bucket{le="5"} 495
http_request_duration_seconds_bucket{le="10"} 500
http_request_duration_seconds_bucket{le="+Inf"} 500
http_request_duration_seconds_sum 125.5
http_request_duration_seconds_count 500

# Request counter by status code
http_requests_total{method="GET",status="200"} 450
http_requests_total{method="GET",status="404"} 30
http_requests_total{method="GET",status="500"} 20

# Default Node.js/process metrics
process_cpu_seconds_total 123.45
process_resident_memory_bytes 52428800
nodejs_heap_size_used_bytes 25165824
nodejs_heap_size_total_bytes 41943040
```

### Example Implementation (NestJS with prom-client)

See `src/main.ts` for the implementation using `prom-client`.

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check ServiceMonitor is created:
```bash
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor tech-challenge-app -n monitoring
```

2. Check Prometheus can reach the target:
```bash
# Port-forward Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# Open http://localhost:9090/targets
# Look for tech-challenge-app - should show "UP"
```

3. Check application is exposing metrics:
```bash
kubectl exec -n tech-challenge deployment/tech-challenge-app -- curl http://localhost:3000/metrics
```

### Alerts not firing

1. Check PrometheusRule is loaded:
```bash
kubectl get prometheusrule -n monitoring
kubectl describe prometheusrule tech-challenge-alerts -n monitoring
```

2. Check rule syntax in Prometheus UI:
```bash
# http://localhost:9090/rules
# Look for tech-challenge-alerts rules
```

3. Manually execute query to verify it returns data:
```bash
# http://localhost:9090/graph
# Execute the alert query
```

### ServiceMonitor not being picked up

Check labels match Prometheus selector:

```bash
kubectl get prometheus -n monitoring prometheus-kube-prometheus-prometheus -o yaml | grep -A 10 serviceMonitorSelector
```

Ensure ServiceMonitor has matching labels (usually `release: prometheus`).

## Performance

### Scrape Intervals

- Application metrics: 30s
- MongoDB metrics: 30s

### Retention

- Prometheus retention: 15 days
- Storage: 20Gi

### Resource Usage

Approximate resource usage with these metrics:

- **Prometheus**: 200m-1000m CPU, 512Mi-2Gi memory
- **ServiceMonitors**: Negligible overhead
- **Samples/sec**: ~1000 samples/sec with 2 app pods + 1 MongoDB pod

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/best-practices-for-creating-dashboards/)
