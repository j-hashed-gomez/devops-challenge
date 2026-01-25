# Random password for MongoDB
resource "random_password" "mongodb_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# AWS Secrets Manager Secret
resource "aws_secretsmanager_secret" "mongodb_credentials" {
  name        = "tech-challenge/mongodb/credentials"
  description = "MongoDB credentials for tech-challenge application"
  
  recovery_window_in_days = 7
  
  tags = {
    Name        = "tech-challenge-mongodb-credentials"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Secret Version with credentials
resource "aws_secretsmanager_secret_version" "mongodb_credentials" {
  secret_id = aws_secretsmanager_secret.mongodb_credentials.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.mongodb_password.result
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}
