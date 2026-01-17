# CI/CD Pipeline Documentation

This document describes the automated CI/CD pipeline for the Tech Challenge application.

## Overview

The pipeline implements a three-tier workflow strategy:

1. **CI Workflow**: Quality gates for pull requests and dev branch
2. **Build Main Workflow**: Validation builds for main branch (non-tagged)
3. **Release Workflow**: Production releases with semantic versioning

## Workflows

### 1. CI - Lint and Test (`ci.yml`)

**Triggers:**
- Pull requests to `main` or `dev`
- Pushes to `dev` branch

**Steps:**
1. Checkout code
2. Setup Node.js 20 with pnpm
3. Install dependencies
4. Run ESLint
5. Run unit tests
6. Run e2e tests
7. Build application
8. Build Docker image (no push)
9. Run Trivy security scan
10. Upload security results to GitHub

**Purpose:** Ensure code quality before merging

### 2. Build Main Branch (`build-main.yml`)

**Triggers:**
- Push to `main` branch without tags

**Steps:**
1. All steps from CI workflow
2. Build Docker image
3. Run Trivy scan (fails on CRITICAL/HIGH)
4. Push image with tag: `main-{sha}`

**Image Tags:**
- `ghcr.io/j-hashed-gomez/devops-challenge:main-abc1234`

**Purpose:** Validate main branch builds without creating a release

### 3. Release - Build and Push (`release.yml`)

**Triggers:**
- Git tag matching `v*.*.*` (semantic versioning)

**Steps:**
1. Validate semantic version format
2. Run full test suite (lint + tests + e2e)
3. Build Docker image
4. Run Trivy security scan (fails on CRITICAL/HIGH)
5. Generate SBOM (Software Bill of Materials)
6. Push image with multiple tags
7. Create GitHub Release with notes and SBOM

**Image Tags:**
For tag `v1.2.3`:
- `ghcr.io/j-hashed-gomez/devops-challenge:v1.2.3`
- `ghcr.io/j-hashed-gomez/devops-challenge:v1.2`
- `ghcr.io/j-hashed-gomez/devops-challenge:v1`
- `ghcr.io/j-hashed-gomez/devops-challenge:latest`

**Purpose:** Create production-ready releases

## Workflow Strategy

### Development Flow

```bash
# Developer works on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git commit -m "Add new feature"
git push origin feature/new-feature

# Create PR to dev
# → CI workflow runs (lint, test, build verification)

# After PR approval, merge to dev
# → CI workflow runs again

# When ready for release, merge dev to main
git checkout main
git merge dev
git push origin main
# → Build Main workflow runs (creates main-{sha} image)

# Create semantic version tag for release
git tag v1.0.0
git push origin v1.0.0
# → Release workflow runs (creates versioned images)
```

### Image Tag Strategy

| Branch/Tag | Image Tag | Use Case |
|------------|-----------|----------|
| `dev` | None | CI validation only |
| `main` | `main-{sha}` | Staging/validation |
| `v1.2.3` | `v1.2.3`, `v1.2`, `v1`, `latest` | Production |

## Security Features

### Trivy Scanning

All builds include vulnerability scanning with Trivy:
- Scans for CRITICAL and HIGH severity vulnerabilities
- Workflow fails if vulnerabilities found
- Results uploaded to GitHub Security tab
- SARIF format for integration with GitHub Advanced Security

### SBOM Generation

Release builds generate a CycloneDX SBOM:
- Lists all dependencies and versions
- Attached to GitHub Release
- Useful for compliance and security audits

### Secrets Management

- No credentials hardcoded in workflows
- GitHub Secrets used for sensitive data
- `GITHUB_TOKEN` auto-provided for registry auth

## Registry

**GitHub Container Registry (ghcr.io)**

Advantages:
- Free for public repositories
- Integrated with GitHub permissions
- Automatic authentication via `GITHUB_TOKEN`
- Same namespace as repository

## Permissions Required

Workflows require the following permissions:
- `contents: read` - Read repository code
- `contents: write` - Create releases (release workflow)
- `packages: write` - Push to ghcr.io
- `security-events: write` - Upload Trivy results

These are configured in each workflow file.

## Local Testing

### Test Docker Build Locally

```bash
# Build the image
docker build -t devops-challenge:local .

# Run Trivy scan
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest \
  image --severity CRITICAL,HIGH \
  devops-challenge:local
```

### Test with Act (GitHub Actions locally)

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act pull_request -W .github/workflows/ci.yml

# Run release workflow (requires tag)
act push -W .github/workflows/release.yml
```

## Troubleshooting

### Build Fails on Trivy Scan

**Issue:** Critical or high vulnerabilities found

**Solution:**
1. Review Trivy output in workflow logs
2. Update vulnerable dependencies in `package.json`
3. Rebuild base image if Node.js vulnerability
4. Check if distroless image needs update

### Tests Fail in CI but Pass Locally

**Issue:** Different environment or cached dependencies

**Solution:**
1. Ensure `pnpm-lock.yaml` is committed
2. Use `pnpm install --frozen-lockfile` locally
3. Check Node.js version matches (20.x)
4. Review workflow logs for specific errors

### Image Push Fails

**Issue:** Permission denied to ghcr.io

**Solution:**
1. Verify repository permissions in Settings → Actions
2. Ensure `packages: write` permission in workflow
3. Check if GitHub Actions enabled for repository

### Tag Not Triggering Release

**Issue:** Release workflow doesn't run

**Solution:**
1. Verify tag format: `v1.2.3` (must start with 'v')
2. Ensure tag is pushed: `git push origin v1.2.3`
3. Check Actions tab for workflow run status

## Best Practices

### Semantic Versioning

Follow semantic versioning guidelines:
- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features, backwards compatible
- **PATCH** (v1.0.1): Bug fixes, backwards compatible

### When to Create Releases

- After merging tested features from dev
- When ready for production deployment
- After critical security patches
- For milestone completions

### Pre-release Tags

For beta/rc releases, use:
```bash
git tag v1.0.0-beta.1
git tag v1.0.0-rc.1
```

These will trigger the release workflow but won't update `latest` tag.

## Metrics and Monitoring

### Workflow Duration

Typical execution times:
- **CI Workflow**: 3-5 minutes
- **Build Main**: 5-7 minutes
- **Release**: 6-8 minutes

### Success Rate

Monitor in repository Insights → Actions:
- Target: >95% success rate
- Common failures: Test failures, Trivy vulnerabilities

## Next Steps

1. Configure GitHub branch protection rules
2. Require CI workflow to pass before merge
3. Set up automated dependency updates (Dependabot)
4. Add deployment workflows for EKS
5. Implement rollback mechanisms
